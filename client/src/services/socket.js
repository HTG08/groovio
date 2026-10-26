
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:8888";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});
