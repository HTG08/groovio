import { useState } from "react";
import axios from "axios";
import {
  Disc3,
  ArrowRight,
  Plus,
  Users,
  Radio,
  ListMusic,
  MessageCircle,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import "./App.css";

const API = "http://localhost:8888/api/rooms";

export default function App() {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function submitRoom(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response =
        mode === "create"
          ? await axios.post(`${API}/create`, {
              name: roomName,
              hostName: name,
            })
          : await axios.post(`${API}/join`, {
              code: code.trim().toUpperCase(),
              userName: name,
            });

      setRoom(response.data.room);

      sessionStorage.setItem("groovioUserId", response.data.userId);

      sessionStorage.setItem("groovioRoomCode", response.data.room.code);

      sessionStorage.setItem("groovioName", name);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to connect. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Please copy the code manually.");
    }
  }

  function goHome() {
    setMode(null);
    setRoom(null);
    setName("");
    setRoomName("");
    setCode("");
    setError("");
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="brand" onClick={goHome}>
          <Disc3 size={30} />
          <span>
            groovio<span className="brand-dot">.</span>
          </span>
        </div>

        <span className="nav-tag">YOUR MUSIC. TOGETHER.</span>
      </header>

      <main className="content">
        {room ? (
          <section className="room-card">
            <div className="eyebrow">
              <span className="live-dot" />
              ROOM CREATED / JOINED
            </div>

            <h1>You're in.</h1>
            <p className="muted">
              Welcome to {room.name}, {name}.
            </p>

            <div className="room-code-box">
              <span>INVITE CODE</span>
              <div className="code-row">
                <strong>{room.code}</strong>
                <button
                  className="copy-btn"
                  onClick={copyCode}
                  title="Copy room code"
                >
                  {copied ? <Check /> : <Copy />}
                </button>
              </div>
            </div>

            <div className="member-box">
              <Users size={20} />
              <span>{room.members?.length || 1} member(s)</span>
            </div>

            <p className="room-note">
              Your room is ready. The shared player, music queue, and chat are
              the next features we'll connect here.
            </p>

            <button className="secondary-btn" onClick={goHome}>
              <ArrowLeft size={18} />
              Back to home
            </button>
          </section>
        ) : mode ? (
          <section className="form-card">
            <button className="back-link" onClick={goHome}>
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
              <label>Your name</label>
              <input
                type="text"
                placeholder="What should we call you?"
                value={name}
                maxLength={30}
                required
                onChange={(e) => setName(e.target.value)}
              />

              {mode === "create" ? (
                <>
                  <label>Room name</label>
                  <input
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
                  <label>Room code</label>
                  <input
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
