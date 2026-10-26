
const crypto = require("crypto");
const https = require("https");
const Room = require("../models/Room");
const {
  createRoomToken,
  verifyRoomToken,
} = require("../utils/roomAuth");

// GENERATE ROOM CODE

function generateRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// DEFAULT MP3 TRACKS

const TRACKS = [
  {
    id: "track1",
    title: "SoundHelix Song 1",
    artist: "SoundHelix",
    audioUrl: "/music/track1.mp3",
  },
  {
    id: "track2",
    title: "SoundHelix Song 2",
    artist: "SoundHelix",
    audioUrl: "/music/track2.mp3",
  },
  {
    id: "track3",
    title: "SoundHelix Song 3",
    artist: "SoundHelix",
    audioUrl: "/music/track3.mp3",
  },
];

// AUTHENTICATION

function getAuthenticatedUser(req, roomCode) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Missing authentication token");
  }

  const identity = verifyRoomToken(
    authorization.slice(7).trim()
  );

  if (identity.roomCode !== roomCode) {
    throw new Error("Token does not belong to this room");
  }

  return identity.userId;
}

// YOUTUBE METADATA

function fetchYouTubeVideo(youtubeId) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return reject(
        new Error("YouTube API key is not configured")
      );
    }

    const url = new URL(
      "https://www.googleapis.com/youtube/v3/videos"
    );

    url.searchParams.set("part", "snippet,status");
    url.searchParams.set("id", youtubeId);
    url.searchParams.set("key", apiKey);

    const request = https.get(
      url,
      { timeout: 10000 },
      (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;

          if (body.length > 1024 * 1024) {
            response.destroy(
              new Error("YouTube response too large")
            );
          }
        });

        response.on("end", () => {
          if (response.statusCode !== 200) {
            return reject(
              new Error("YouTube metadata request failed")
            );
          }

          try {
            const data = JSON.parse(body);
            const video = data.items?.[0];

            if (
              !video ||
              video.status?.embeddable !== true ||
              video.status?.privacyStatus !== "public"
            ) {
              return resolve(null);
            }

            resolve({
              id: youtubeId,
              title: video.snippet.title,
              artist: video.snippet.channelTitle,
              thumbnail:
                video.snippet.thumbnails?.medium?.url || "",
            });
          } catch {
            reject(new Error("Invalid YouTube response"));
          }
        });

        response.on("error", reject);
      }
    );

    request.on("error", reject);

    request.on("timeout", () => {
      request.destroy(
        new Error("YouTube request timed out")
      );
    });
  });
}

// CREATE ROOM

exports.createRoom = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const hostName = req.body.hostName?.trim();

    if (!name || !hostName) {
      return res.status(400).json({
        success: false,
        message: "Room name and host name are required",
      });
    }

    const hostId = crypto.randomUUID();

    const room = await Room.create({
      name,
      code: generateRoomCode(),
      hostId,
      members: [
        {
          userId: hostId,
          name: hostName,
        },
      ],
      queue: [],
      hostOnlyControls: true,
    });

    const token = createRoomToken({
      roomCode: room.code,
      userId: hostId,
    });

    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      room,
      userId: hostId,
      token,
    });
  } catch (error) {
    console.error("Create room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create room",
    });
  }
};

// JOIN ROOM

exports.joinRoom = async (req, res) => {
  try {
    const code = req.body.code?.trim().toUpperCase();
    const userName = req.body.userName?.trim();

    if (!code || !userName) {
      return res.status(400).json({
        success: false,
        message: "Room code and name are required",
      });
    }

    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const userId = crypto.randomUUID();

    room.members.push({
      userId,
      name: userName,
    });

    await room.save();

    const token = createRoomToken({
      roomCode: room.code,
      userId,
    });

    return res.json({
      success: true,
      message: "Joined room successfully",
      room,
      userId,
      token,
    });
  } catch (error) {
    console.error("Join room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to join room",
    });
  }
};

// GET ROOM

exports.getRoom = async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const roomData = room.toObject();

    delete roomData.hostId;

    roomData.members = roomData.members.map(
      (member) => ({
        name: member.name,
      })
    );

    return res.json({
      success: true,
      room: roomData,
    });
  } catch (error) {
    console.error("Get room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch room",
    });
  }
};

// ADD TO QUEUE / PLAY NEXT

exports.addToQueue = async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const {
      trackId,
      source,
      youtubeId,
      playNext = false,
    } = req.body;

    let userId;

    try {
      userId = getAuthenticatedUser(req, code);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    if (typeof playNext !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "playNext must be true or false",
      });
    }

    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const isMember = room.members.some(
      (member) => member.userId === userId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this room",
      });
    }

    if (
      room.hostOnlyControls &&
      room.hostId !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the host can add tracks",
      });
    }

    let queueItem;

    if (source === "youtube") {
      if (
        typeof youtubeId !== "string" ||
        !/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid YouTube video ID",
        });
      }

      const video = await fetchYouTubeVideo(youtubeId);

      if (!video) {
        return res.status(400).json({
          success: false,
          message: "This YouTube video cannot be embedded",
        });
      }

      queueItem = {
        queueItemId: crypto.randomUUID(),
        songId: `youtube:${video.id}`,
        title: video.title,
        artist: video.artist,
        source: "youtube",
        audioUrl: "",
        youtubeId: video.id,
        thumbnail: video.thumbnail,
      };
    } else if (
      source === undefined ||
      source === "mp3"
    ) {
      const track = TRACKS.find(
        (song) => song.id === trackId
      );

      if (!track) {
        return res.status(400).json({
          success: false,
          message: "Invalid MP3 track",
        });
      }

      queueItem = {
        queueItemId: crypto.randomUUID(),
        songId: track.id,
        title: track.title,
        artist: track.artist,
        source: "mp3",
        audioUrl: track.audioUrl,
        youtubeId: "",
        thumbnail: "",
      };
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported track source",
      });
    }

    if (playNext) {
      const currentIndex = room.queue.findIndex(
        (item) =>
          item.queueItemId ===
          room.playback?.queueItemId
      );

      room.queue.splice(
        currentIndex === -1 ? 0 : currentIndex + 1,
        0,
        queueItem
      );
    } else {
      room.queue.push(queueItem);
    }

    await room.save();

    const io = req.app.get("io");

    io.to(code).emit("queue-updated", {
      roomCode: code,
      queue: room.queue,
    });

    return res.json({
      success: true,
      message: playNext
        ? "Track added to play next"
        : "Track added to queue",
      queue: room.queue,
      queueItemId: queueItem.queueItemId,
    });
  } catch (error) {
    console.error("Add to queue error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update queue",
    });
  }
};

// UPDATE HOST-ONLY PERMISSIONS
// ONLY THE HOST CAN CHANGE THIS SETTING

exports.updateRoomPermissions = async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const { hostOnlyControls } = req.body;

    let userId;

    try {
      userId = getAuthenticatedUser(req, code);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    if (typeof hostOnlyControls !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "hostOnlyControls must be true or false",
      });
    }

    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const isMember = room.members.some(
      (member) => member.userId === userId
    );

    if (!isMember || room.hostId !== userId) {
      return res.status(403).json({
        success: false,
        message:
          "Only the host can change room permissions",
      });
    }

    room.hostOnlyControls = hostOnlyControls;

    await room.save();

    req.app
      .get("io")
      .to(code)
      .emit("permissions-updated", {
        roomCode: code,
        hostOnlyControls: room.hostOnlyControls,
      });

    return res.json({
      success: true,
      message: "Room permissions updated",
      hostOnlyControls: room.hostOnlyControls,
    });
  } catch (error) {
    console.error("Permissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update permissions",
    });
  }
};

// DELETE QUEUE
//
// HOST ONLY ON:
//   Host can delete.
//   Members cannot delete.
//
// HOST ONLY OFF:
//   Host and members can delete.
//
// Queue deletion also resets playback and
// broadcasts the update to every connected user.

exports.clearQueue = async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    let userId;

    try {
      userId = getAuthenticatedUser(req, code);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const isMember = room.members.some(
      (member) => member.userId === userId
    );

    const isHost = room.hostId === userId;

    // FIX: Respect Host Only mode instead of
    // permanently restricting deletion to host.
    if (
      !isMember ||
      (room.hostOnlyControls && !isHost)
    ) {
      return res.status(403).json({
        success: false,
        message: room.hostOnlyControls
          ? "Only the host can delete the queue when Host Only is ON"
          : "You are not a member of this room",
      });
    }

    // Clear queue and stop current playback.
    room.queue = [];

    room.playback.songId = null;
    room.playback.queueItemId = null;
    room.playback.isPlaying = false;
    room.playback.position = 0;
    room.playback.updatedAt = new Date();

    await room.save();

    const io = req.app.get("io");

    // Update queue for every connected user.
    io.to(code).emit("queue-updated", {
      roomCode: code,
      queue: [],
    });

    // Stop playback for every connected user.
    io.to(code).emit("playback-updated", {
      roomCode: code,
      playback: room.playback,
    });

    return res.json({
      success: true,
      message: "Queue deleted successfully",
      queue: [],
      playback: room.playback,
    });
  } catch (error) {
    console.error("Clear queue error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete queue",
    });
  }
};
