import { useEffect, useState } from "react";
import axios from "axios";

import {
  Disc3,
  ArrowRight,
  Plus,
  Radio,
  ListMusic,
  MessageCircle,
  ArrowLeft,
} from "lucide-react";

import RoomPage from "./pages/RoomPage";
import "./App.css";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8888";

const API = `${SERVER_URL}/api/rooms`;

const SESSION_KEYS = [
  "groovioUserId",
  "groovioRoomCode",
  "groovioName",
  "groovioToken",
];

function clearSavedSession() {
  SESSION_KEYS.forEach((key) => {
    sessionStorage.removeItem(key);
  });
}

export default function App() {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState("");

  // Restore a previously saved room session.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const savedRoomCode = sessionStorage.getItem("groovioRoomCode");

      const savedUserId = sessionStorage.getItem("groovioUserId");

      const savedName = sessionStorage.getItem("groovioName");

      const savedToken = sessionStorage.getItem("groovioToken");

      if (!savedRoomCode || !savedUserId || !savedName || !savedToken) {
        clearSavedSession();

        if (!cancelled) {
          setRestoring(false);
        }

        return;
      }

      try {
        const response = await axios.get(`${API}/${savedRoomCode}`);

        if (cancelled) return;

        const savedRoom = response.data.room;

        if (!response.data.success || savedRoom.code !== savedRoomCode) {
          throw new Error("Could not restore the room.");
        }

        // The public endpoint deliberately hides
        // member IDs and host ID.
        // The next step will authenticate this
        // saved token through Socket.IO.
        setName(savedName);
        setRoom(savedRoom);
        setMode(null);
      } catch (err) {
        if (cancelled) return;

        console.error("Could not restore room:", err);

        clearSavedSession();

        setRoom(null);
        setMode(null);
        setName("");
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitRoom(e) {
    e.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      let response;

      if (mode === "create") {
        response = await axios.post(`${API}/create`, {
          name: roomName.trim(),
          hostName: name.trim(),
        });
      } else {
        response = await axios.post(`${API}/join`, {
          code: code.trim().toUpperCase(),
          userName: name.trim(),
        });
      }

      const data = response.data;

      if (!data.success || !data.room?.code || !data.userId || !data.token) {
        throw new Error(data.message || "Could not start your room session.");
      }

      // Store the signed room-session token.
      sessionStorage.setItem("groovioToken", data.token);

      sessionStorage.setItem("groovioUserId", data.userId);

      sessionStorage.setItem("groovioRoomCode", data.room.code);

      sessionStorage.setItem("groovioName", name.trim());

      setRoom(data.room);
      setMode(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to connect. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function goHome() {
    setMode(null);
    setRoom(null);
    setName("");
    setRoomName("");
    setCode("");
    setError("");

    clearSavedSession();
  }

  return (
    <div className="app">
      <header className="navbar">
        <div
          className="brand"
          onClick={goHome}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              goHome();
            }
          }}
        >
          <Disc3 size={30} />

          <span>
            groovio
            <span className="brand-dot">.</span>
          </span>
        </div>

        <span className="nav-tag">YOUR MUSIC. TOGETHER.</span>
      </header>

      <main className="content">
        {restoring ? (
          <section
            className="form-card"
            style={{
              textAlign: "center",
              margin: "60px auto",
            }}
          >
            <Disc3
              size={42}
              color="#d6fa72"
              style={{
                marginBottom: "15px",
              }}
            />

            <h2>Getting your groove back...</h2>

            <p className="muted">Reconnecting to your listening room.</p>
          </section>
        ) : room ? (
          <RoomPage room={room} userName={name} onLeave={goHome} />
        ) : mode ? (
          <section className="form-card">
            <button className="back-link" onClick={goHome} type="button">
              <ArrowLeft size={18} />
              Back
            </button>

            <div className="eyebrow">
              {mode === "create" ? "START A SESSION" : "JOIN THE VIBE"}
            </div>

            <h1>{mode === "create" ? "Set the mood." : "Find your people."}</h1>

            <p className="muted">
              {mode === "create"
                ? "Give your listening room a name."
                : "Enter your friend's room code."}
            </p>

            <form onSubmit={submitRoom}>
              <label htmlFor="username">Your name</label>

              <input
                id="username"
                type="text"
                placeholder="What should we call you?"
                value={name}
                maxLength={30}
                required
                onChange={(e) => setName(e.target.value)}
              />

              {mode === "create" ? (
                <>
                  <label htmlFor="roomname">Room name</label>

                  <input
                    id="roomname"
                    type="text"
                    placeholder="e.g. Late Night Vibes"
                    value={roomName}
                    maxLength={50}
                    required
                    onChange={(e) => setRoomName(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <label htmlFor="roomcode">Room code</label>

                  <input
                    id="roomcode"
                    type="text"
                    placeholder="e.g. 80C72C"
                    value={code}
                    maxLength={6}
                    required
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </>
              )}

              {error && <p className="error">{error}</p>}

              <button
                className="primary-btn full"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : mode === "create"
                    ? "Create Room"
                    : "Join Room"}

                <ArrowRight size={19} />
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="hero-content">
                <div className="eyebrow">
                  <span className="live-dot" />
                  THE LISTENING CLUB
                </div>

                <h1>
                  Good music hits
                  <br />
                  <span>different together.</span>
                </h1>

                <p className="hero-description">
                  Your favorite tracks. Your favorite people. One shared
                  listening experience. No distance, just good music.
                </p>

                <div className="hero-actions">
                  <button
                    className="primary-btn"
                    onClick={() => setMode("create")}
                  >
                    <Plus size={20} />
                    Create a Room
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={() => setMode("join")}
                  >
                    Join a Room
                    <ArrowRight size={19} />
                  </button>
                </div>

                <div className="hero-footer">
                  <span className="pulse-dot" />
                  THE PARTY STARTS WITH YOU
                </div>
              </div>

              <div className="hero-art">
                <div className="record-outer">
                  <div className="record-inner">
                    <div className="record-label">
                      <Disc3 size={52} />

                      <span>GROOVIO</span>

                      <small>SIDE A • 33 RPM</small>
                    </div>
                  </div>
                </div>

                <div className="floating-note">♫</div>
              </div>
            </section>

            <section className="features">
              <div className="feature">
                <Radio size={25} />

                <h3>In sync, always.</h3>

                <p>One room. One soundtrack. Together.</p>
              </div>

              <div className="feature">
                <ListMusic size={25} />

                <h3>Pass the aux.</h3>

                <p>Build a shared queue with your crew.</p>
              </div>

              <div className="feature">
                <MessageCircle size={25} />

                <h3>Keep talking.</h3>

                <p>Chat while the music plays.</p>
              </div>
            </section>
          </>
        )}
      </main>

      <footer>
        <span>© 2026 GROOVIO</span>

        <span>MADE FOR THE MOMENTS THAT MATTER ♫</span>
      </footer>
    </div>
  );
}
