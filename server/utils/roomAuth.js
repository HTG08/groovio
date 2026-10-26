
const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set to a secure value of at least 32 characters."
    );
  }

  return secret;
}

// Generate a signed token for a room member.
function createRoomToken({ roomCode, userId }) {
  if (!roomCode || !userId) {
    throw new Error(
      "Room code and user ID are required."
    );
  }

  return jwt.sign(
    {
      roomCode: String(roomCode).toUpperCase(),
      userId: String(userId),
      tokenType: "room-session"
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
      algorithm: "HS256"
    }
  );
}

// Verify a token and return its authenticated identity.
function verifyRoomToken(token) {
  if (typeof token !== "string" || !token) {
    throw new Error("Missing room session token.");
  }

  const payload = jwt.verify(
    token,
    getJwtSecret(),
    {
      algorithms: ["HS256"]
    }
  );

  if (
    payload.tokenType !== "room-session" ||
    typeof payload.roomCode !== "string" ||
    typeof payload.userId !== "string" ||
    !payload.roomCode ||
    !payload.userId
  ) {
    throw new Error("Invalid room session token.");
  }

  return {
    roomCode: payload.roomCode,
    userId: payload.userId
  };
}

module.exports = {
  createRoomToken,
  verifyRoomToken
};
