
const mongoose = require("mongoose");

// Each song added to the queue gets a unique entry ID.
// Supports both MP3 tracks and YouTube videos.
const queueItemSchema = new mongoose.Schema({
  queueItemId: {
    type: String,
    required: true,
  },

  songId: {
    type: String,
    required: true,
  },

  title: {
    type: String,
    required: true,
  },

  artist: {
    type: String,
    required: true,
  },

  // "mp3" for local audio, "youtube" for YouTube videos.
  source: {
    type: String,
    enum: ["mp3", "youtube"],
    default: "mp3",
  },

  // Used by the existing HTML audio player.
  audioUrl: {
    type: String,
    default: "",
  },

  // Used by the YouTube IFrame Player API.
  youtubeId: {
    type: String,
    default: "",
  },

  thumbnail: {
    type: String,
    default: "",
  },
});

// Main room schema
const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    code: {
      type: String,
      required: true,
      unique: true,
    },

    hostId: {
      type: String,
      required: true,
    },

    hostOnlyControls: {
      type: Boolean,
      default: true,
    },

    members: [
      {
        userId: {
          type: String,
          required: true,
        },

        name: {
          type: String,
          required: true,
        },
      },
    ],

    queue: [queueItemSchema],

    playback: {
      songId: {
        type: String,
        default: null,
      },

      queueItemId: {
        type: String,
        default: null,
      },

      isPlaying: {
        type: Boolean,
        default: false,
      },

      position: {
        type: Number,
        default: 0,
      },

      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Room", roomSchema);
