const express = require("express");
const router = express.Router();

const {
  createRoom,
  joinRoom,
  getRoom,
  addToQueue,
  updateRoomPermissions,
  clearQueue,
} = require("../controllers/roomController");

const {
  searchYouTube,
} = require("../controllers/youtubeController");

router.post("/create", createRoom);
router.post("/join", joinRoom);
router.get("/youtube/search", searchYouTube);
router.get("/:code", getRoom);
router.post("/:code/queue", addToQueue);
router.delete("/:code/queue", clearQueue);
router.patch("/:code/permissions", updateRoomPermissions);

module.exports = router;