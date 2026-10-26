
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },

    code: {
      type: String,
      required: true,
      unique: true
    },

    hostId: {
      type: String,
      required: true
    },

    members: [
      {
        userId: String,
        name: String
      }
    ],

    queue: [
      {
        songId: String,
        title: String,
        artist: String,
        audioUrl: String
      }
    ],

    playback: {
      songId: {
        type: String,
        default: null
      },
      isPlaying: {
        type: Boolean,
        default: false
      },
      position: {
        type: Number,
        default: 0
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
