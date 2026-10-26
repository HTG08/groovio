
const crypto = require("crypto");
const Room = require("../models/Room");

function generateRoomCode() {
  return crypto.randomBytes(5)
    .toString("hex")
    .slice(0, 6)
    .toUpperCase();
}

exports.createRoom = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const hostName = req.body.hostName?.trim();

    if (!name || !hostName) {
      return res.status(400).json({
        success: false,
        message: "Room name and host name are required"
      });
    }

    const hostId = crypto.randomUUID();

    let room;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();

      try {
        room = await Room.create({
          name,
          code,
          hostId,
          members: [
            {
              userId: hostId,
              name: hostName
            }
          ]
        });

        break;
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }
      }
    }

    if (!room) {
      return res.status(503).json({
        success: false,
        message: "Could not generate a unique room code"
      });
    }

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      room,
      userId: hostId
    });

  } catch (error) {
    console.error("Create room error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to create room"
    });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const code = req.body.code?.trim().toUpperCase();
    const userName = req.body.userName?.trim();

    if (!code || !userName) {
      return res.status(400).json({
        success: false,
        message: "Room code and username are required"
      });
    }

    if (!/^[A-Z0-9]{6}$/.test(code) || userName.length > 30) {
      return res.status(400).json({
        success: false,
        message: "Invalid room code or username"
      });
    }

    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const userId = crypto.randomUUID();

    room.members.push({
      userId,
      name: userName
    });

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Joined room successfully",
      room,
      userId
    });

  } catch (error) {
    console.error("Join room error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to join room"
    });
  }
};
