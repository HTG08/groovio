
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const Room = require("./models/Room");
const roomRoutes = require("./routes/roomRoutes");
const { verifyRoomToken } = require("./utils/roomAuth");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8888;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

app.set("io", io);
app.use("/api/rooms", roomRoutes);

function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase();
}

function getPlaybackState(room) {
  const playback = room.playback || {};

  const updatedAt = playback.updatedAt
    ? new Date(playback.updatedAt).getTime()
    : Date.now();

  const elapsed = playback.isPlaying
    ? Math.max(0, (Date.now() - updatedAt) / 1000)
    : 0;

  return {
    songId: playback.songId || null,
    queueItemId: playback.queueItemId || null,
    isPlaying: Boolean(playback.isPlaying),
    position: Math.max(
      0,
      Number(playback.position || 0) + elapsed
    ),
    updatedAt: Date.now(),
  };
}

// Verify JWT and room membership.
async function authenticateRoomMember(token, roomCode) {
  const identity = verifyRoomToken(token);

  if (identity.roomCode !== roomCode) {
    throw new Error("Token does not belong to this room");
  }

  const room = await Room.findOne({ code: roomCode });

  if (!room) {
    throw new Error("Room not found");
  }

  const member = room.members.find(
    (item) => item.userId === identity.userId
  );

  if (!member) {
    throw new Error("You are not a member of this room");
  }

  return {
    room,
    member,
    userId: identity.userId,
    isHost: room.hostId === identity.userId,
  };
}

// LIVE LISTENERS

const liveListeners = new Map();

function getRoomListeners(roomCode) {
  const listeners = liveListeners.get(roomCode);

  if (!listeners) return [];

  return Array.from(listeners.values()).map((listener) => ({
    userId: listener.userId,
    name: listener.name,
    isHost: listener.isHost,
  }));
}

function broadcastListeners(roomCode) {
  io.to(roomCode).emit("listeners-updated", {
    roomCode,
    listeners: getRoomListeners(roomCode),
  });
}

function removeListener(socket) {
  const roomCode = socket.data.listenerRoomCode;

  if (!roomCode) return;

  const listeners = liveListeners.get(roomCode);

  if (listeners) {
    listeners.delete(socket.id);

    if (listeners.size === 0) {
      liveListeners.delete(roomCode);
    }
  }

  socket.data.listenerRoomCode = null;
  socket.data.userId = null;

  broadcastListeners(roomCode);
}

// CHAT HISTORY

const roomMessages = new Map();
const MAX_MESSAGES = 50;

function getRoomMessages(roomCode) {
  return roomMessages.get(roomCode) || [];
}

function sendRoomError(socket, message) {
  socket.emit("room-error", { message });
}

// SOCKET.IO

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // AUTHENTICATED ROOM JOIN
  socket.on("join-room", async (data = {}) => {
    try {
      const roomCode = normalizeRoomCode(data.roomCode);
      const token = data.token;

      if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
        sendRoomError(socket, "Invalid room code");
        return;
      }

      const {
        room,
        member,
        userId,
        isHost,
      } = await authenticateRoomMember(token, roomCode);

      // Leave any previous room.
      const previousRoom = socket.data.listenerRoomCode;

      if (previousRoom) {
        removeListener(socket);
        socket.leave(previousRoom);
      }

      socket.join(roomCode);

      socket.data.listenerRoomCode = roomCode;
      socket.data.userId = userId;

      if (!liveListeners.has(roomCode)) {
        liveListeners.set(roomCode, new Map());
      }

      liveListeners.get(roomCode).set(socket.id, {
        userId,
        name: member.name,
        isHost,
      });

      socket.emit("room-joined", {
        roomCode,
        message: "Connected to Groovio room",
        userId,
        isHost,
      });

      socket.emit("playback-updated", {
        roomCode,
        playback: getPlaybackState(room),
      });

      socket.emit("permissions-updated", {
        roomCode,
        hostOnlyControls: room.hostOnlyControls,
      });

      socket.emit("chat-history", {
        roomCode,
        messages: getRoomMessages(roomCode),
      });

      broadcastListeners(roomCode);
    } catch (error) {
      sendRoomError(
        socket,
        error.message || "Could not join room"
      );
    }
  });

  // COMPATIBILITY: REGISTER LISTENER
  socket.on("register-listener", async (data = {}) => {
    try {
      const roomCode = normalizeRoomCode(data.roomCode);
      const token = data.token;

      await authenticateRoomMember(token, roomCode);

      if (socket.data.listenerRoomCode !== roomCode) {
        sendRoomError(
          socket,
          "Join the room before registering"
        );
      }
    } catch (error) {
      sendRoomError(
        socket,
        error.message || "Invalid room session"
      );
    }
  });

  // LEAVE LISTENER
  socket.on("leave-listener", () => {
    const roomCode = socket.data.listenerRoomCode;

    if (!roomCode) return;

    removeListener(socket);
    socket.leave(roomCode);
  });

  // AUTHENTICATED CHAT
  socket.on("send-message", async (data = {}) => {
    try {
      const roomCode = normalizeRoomCode(data.roomCode);
      const text = String(data.text || "").trim();

      if (!text || text.length > 500) {
        socket.emit("chat-error", {
          message: "Message must contain 1 to 500 characters.",
        });
        return;
      }

      if (
        socket.data.listenerRoomCode !== roomCode ||
        !socket.data.userId
      ) {
        socket.emit("chat-error", {
          message: "Join the room before sending messages.",
        });
        return;
      }

      const room = await Room.findOne({ code: roomCode });

      if (!room) return;

      const member = room.members.find(
        (item) => item.userId === socket.data.userId
      );

      if (!member) return;

      const message = {
        id: new mongoose.Types.ObjectId().toString(),
        roomCode,
        userId: member.userId,
        name: member.name,
        text,
        createdAt: new Date().toISOString(),
      };

      const messages = getRoomMessages(roomCode);

      messages.push(message);

      if (messages.length > MAX_MESSAGES) {
        messages.shift();
      }

      roomMessages.set(roomCode, messages);

      io.to(roomCode).emit("new-message", {
        roomCode,
        message,
      });
    } catch (error) {
      console.error("Chat error:", error);

      socket.emit("chat-error", {
        message: "Could not send message.",
      });
    }
  });

  // AUTHENTICATED PLAYBACK
  socket.on("playback-control", async (data = {}) => {
    try {
      const roomCode = normalizeRoomCode(data.roomCode);

      const {
        action,
        queueItemId,
        position,
      } = data;

      if (
        socket.data.listenerRoomCode !== roomCode ||
        !socket.data.userId
      ) {
        socket.emit("playback-error", {
          message: "Join the room before controlling music",
        });
        return;
      }

      const room = await Room.findOne({ code: roomCode });

      if (!room) {
        socket.emit("playback-error", {
          message: "Room not found",
        });
        return;
      }

      const userId = socket.data.userId;

      const isMember = room.members.some(
        (member) => member.userId === userId
      );

      if (!isMember) {
        socket.emit("playback-error", {
          message: "You are not a room member",
        });
        return;
      }

      const isHost = room.hostId === userId;

      if (room.hostOnlyControls && !isHost) {
        socket.emit("playback-error", {
          message: "Only the host can control music",
        });
        return;
      }

      const currentPlayback = getPlaybackState(room);

      // FIX: SELECT AND PLAY IN A SINGLE ACTION
      if (
        action === "select" ||
        action === "select-and-play"
      ) {
        const selectedTrack = room.queue.find(
          (track) => track.queueItemId === queueItemId
        );

        if (!selectedTrack) {
          socket.emit("playback-error", {
            message: "Song is not in the queue",
          });
          return;
        }

        room.playback.songId = selectedTrack.songId;
        room.playback.queueItemId = selectedTrack.queueItemId;
        room.playback.position = 0;
        room.playback.isPlaying =
          action === "select-and-play";

      } else if (action === "play") {
        if (!room.playback.queueItemId) {
          socket.emit("playback-error", {
            message: "Select a song first",
          });
          return;
        }

        room.playback.position = currentPlayback.position;
        room.playback.isPlaying = true;

      } else if (action === "pause") {
        room.playback.position = currentPlayback.position;
        room.playback.isPlaying = false;

      } else if (action === "seek") {
        if (
          !Number.isFinite(position) ||
          position < 0
        ) {
          socket.emit("playback-error", {
            message: "Invalid seek position",
          });
          return;
        }

        room.playback.position = position;

      } else {
        socket.emit("playback-error", {
          message: "Unknown playback action",
        });
        return;
      }

      room.playback.updatedAt = new Date();

      await room.save();

      io.to(roomCode).emit("playback-updated", {
        roomCode,
        playback: getPlaybackState(room),
      });
    } catch (error) {
      console.error("Playback control error:", error);

      socket.emit("playback-error", {
        message: "Could not update playback",
      });
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    removeListener(socket);

    console.log("Socket disconnected:", socket.id);
  });
});

// REST API

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Groovio backend is running",
  });
});

// START SERVER

async function startServer() {
  try {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32
    ) {
      throw new Error(
        "JWT_SECRET must contain at least 32 characters"
      );
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully!");

    server.listen(PORT, () => {
      console.log(`Groovio server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup error:", error.message);
    process.exit(1);
  }
}

startServer();
