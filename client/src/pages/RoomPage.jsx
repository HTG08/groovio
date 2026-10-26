import { useEffect, useMemo, useRef, useState } from "react";

import axios from "axios";

import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  Radio,
  ListMusic,
  MessageCircle,
  Wifi,
  WifiOff,
  ShieldCheck,
  Crown,
  Send,
  Search,
  Plus,
  Play,
  Music2,
} from "lucide-react";

import { socket } from "../services/socket";
import MusicPlayer from "../components/MusicPlayer";

const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8888";

function formatMessageTime(date) {
  if (!date) return "";

  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RoomPage({ room, userName, onLeave }) {
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  const [queue, setQueue] = useState(room.queue || []);

  const [playback, setPlayback] = useState(room.playback || null);

  const [listeners, setListeners] = useState([]);

  const [hostOnlyControls, setHostOnlyControls] = useState(
    room.hostOnlyControls ?? true,
  );

  const [isHost, setIsHost] = useState(false);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const [error, setError] = useState("");
  const [addingTrack, setAddingTrack] = useState(false);
  const [clearingQueue, setClearingQueue] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [lastSearch, setLastSearch] = useState("");

  const [updatingPermissions, setUpdatingPermissions] = useState(false);

  const chatBottomRef = useRef(null);
  const searchRequestRef = useRef(0);

  const userId = sessionStorage.getItem("groovioUserId");

  const token = sessionStorage.getItem("groovioToken");

  const canControl = connected && (isHost || !hostOnlyControls);
  const canDeleteQueue = canControl;

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // Find the exact queue entry currently selected.
  const currentTrack = useMemo(() => {
    if (!playback?.queueItemId) return null;

    const song = queue.find(
      (item) => item.queueItemId === playback.queueItemId,
    );

    if (!song) return null;

    return {
      id: song.queueItemId,
      songId: song.songId,
      title: song.title,
      artist: song.artist,
      audioUrl: song.audioUrl,
      source: song.source || "mp3",
      youtubeId: song.youtubeId || "",
      thumbnail: song.thumbnail || "",
    };
  }, [queue, playback?.queueItemId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages]);

  useEffect(() => {
    if (!room?.code) return;

    let active = true;

    async function fetchRoom() {
      try {
        const response = await axios.get(`${API_URL}/api/rooms/${room.code}`);

        if (!active) return;

        const latestRoom = response.data.room;

        setQueue(latestRoom.queue || []);

        setHostOnlyControls(latestRoom.hostOnlyControls ?? true);

        if (latestRoom.playback) {
          setPlayback(latestRoom.playback);
        }
      } catch {
        if (active) {
          setError("Could not load the room.");
        }
      }
    }

    function joinSocketRoom() {
      if (!active) return;

      setConnected(false);
      setIsHost(false);

      if (!token) {
        setError("Missing room session. Leave and rejoin the room.");
        return;
      }

      // The server verifies this JWT and registers
      // the listener using the authenticated identity.
      socket.emit("join-room", {
        roomCode: room.code,
        token,
      });
    }

    function handleRoomJoined(data) {
      if (data.roomCode !== room.code) return;

      setConnected(true);
      setIsHost(Boolean(data.isHost));
      setError("");
    }

    function handleDisconnect() {
      setConnected(false);
      setIsHost(false);
      setListeners([]);
    }

    function handleQueueUpdated(data) {
      if (data.roomCode === room.code) {
        setQueue(data.queue || []);
      }
    }

    function handlePlaybackUpdated(data) {
      if (data.roomCode === room.code) {
        setPlayback(data.playback);
        setError("");
      }
    }

    function handlePlaybackError(data) {
      setError(data.message || "Playback action failed.");
    }

    function handlePermissionsUpdated(data) {
      if (data.roomCode === room.code) {
        setHostOnlyControls(data.hostOnlyControls);
      }
    }

    function handleListenersUpdated(data) {
      if (data.roomCode === room.code) {
        setListeners(data.listeners || []);
      }
    }

    function handleRoomError(data) {
      setConnected(false);
      setIsHost(false);

      setError(data.message || "Room connection failed.");
    }

    function handleChatHistory(data) {
      if (data.roomCode === room.code) {
        setMessages(data.messages || []);
      }
    }

    function handleNewMessage(data) {
      if (data.roomCode !== room.code) return;

      setMessages((previous) => {
        if (previous.some((message) => message.id === data.message.id)) {
          return previous;
        }

        return [...previous, data.message].slice(-50);
      });

      setChatError("");
    }

    function handleChatError(data) {
      setChatError(data.message || "Could not send message.");
    }

    socket.on("connect", joinSocketRoom);
    socket.on("room-joined", handleRoomJoined);
    socket.on("disconnect", handleDisconnect);

    socket.on("queue-updated", handleQueueUpdated);

    socket.on("playback-updated", handlePlaybackUpdated);

    socket.on("playback-error", handlePlaybackError);

    socket.on("permissions-updated", handlePermissionsUpdated);

    socket.on("listeners-updated", handleListenersUpdated);

    socket.on("room-error", handleRoomError);
    socket.on("chat-history", handleChatHistory);
    socket.on("new-message", handleNewMessage);
    socket.on("chat-error", handleChatError);

    if (!socket.connected) {
      socket.connect();
    } else {
      joinSocketRoom();
    }

    fetchRoom();

    return () => {
      active = false;

      if (socket.connected) {
        socket.emit("leave-listener");
      }

      socket.off("connect", joinSocketRoom);
      socket.off("room-joined", handleRoomJoined);
      socket.off("disconnect", handleDisconnect);

      socket.off("queue-updated", handleQueueUpdated);

      socket.off("playback-updated", handlePlaybackUpdated);

      socket.off("playback-error", handlePlaybackError);

      socket.off("permissions-updated", handlePermissionsUpdated);

      socket.off("listeners-updated", handleListenersUpdated);

      socket.off("room-error", handleRoomError);
      socket.off("chat-history", handleChatHistory);
      socket.off("new-message", handleNewMessage);
      socket.off("chat-error", handleChatError);

      socket.disconnect();
    };
  }, [room?.code, token]);

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(room.code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      alert("Please copy the room code manually.");
    }
  }

  function handleSearchChange(event) {
    const value = event.target.value;
    setSearchQuery(value);
    // Invalidate pending responses whenever the query changes.
    searchRequestRef.current += 1;
    setSearchResults([]);
    setLastSearch("");
    setSearchError("");
    setSearching(false);
  }

  async function searchYouTube(event) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2 || query.length > 100) return;

    const requestId = ++searchRequestRef.current;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const response = await axios.get(`${API_URL}/api/rooms/youtube/search`, {
        params: { q: query },
      });
      if (requestId !== searchRequestRef.current) return;
      setSearchResults(response.data.results || []);
      setLastSearch(query);
    } catch (err) {
      if (requestId !== searchRequestRef.current) return;
      setSearchError(
        err.response?.data?.message || "YouTube search failed. Try again.",
      );
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  }

  async function addYouTubeTrack(video, playNext = false) {
    if (!canControl || addingTrack || !token || !video?.youtubeId) return;

    setAddingTrack(true);
    setError("");
    try {
      const response = await axios.post(
        `${API_URL}/api/rooms/${room.code}/queue`,
        { source: "youtube", youtubeId: video.youtubeId, playNext },
        { headers: authHeaders },
      );
      setQueue(response.data.queue || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not add YouTube video.");
    } finally {
      setAddingTrack(false);
    }
  }

  async function clearQueue() {
    if (!canDeleteQueue || clearingQueue || !token || queue.length === 0)
      return;
    if (
      !window.confirm(
        "Delete every song from this room’s queue? Playback will stop for everyone.",
      )
    )
      return;

    setClearingQueue(true);
    setError("");
    try {
      const response = await axios.delete(
        `${API_URL}/api/rooms/${room.code}/queue`,
        { headers: authHeaders },
      );
      setQueue(response.data.queue || []);
      if (response.data.playback) setPlayback(response.data.playback);
    } catch (err) {
      setError(err.response?.data?.message || "Could not clear the queue.");
    } finally {
      setClearingQueue(false);
    }
  }

  function playQueueItem(queueItemId) {
    if (!canControl || !queueItemId) return;
    if (playback?.queueItemId === queueItemId) {
      sendPlaybackControl("play");
    } else {
      sendPlaybackControl("select-and-play", { queueItemId });
    }
  }

  async function playSearchResult(video) {
    if (!canControl || addingTrack || !token || !video?.youtubeId) return;
    setAddingTrack(true);
    setError("");
    try {
      const response = await axios.post(
        `${API_URL}/api/rooms/${room.code}/queue`,
        { source: "youtube", youtubeId: video.youtubeId, playNext: false },
        { headers: authHeaders },
      );
      const updatedQueue = response.data.queue || [];
      setQueue(updatedQueue);
      // Use the unique queue ID so duplicate songs work correctly.
      const added = updatedQueue[updatedQueue.length - 1];
      if (added?.queueItemId) playQueueItem(added.queueItemId);
    } catch (err) {
      setError(err.response?.data?.message || "Could not play this video.");
    } finally {
      setAddingTrack(false);
    }
  }

  function sendPlaybackControl(action, extra = {}) {
    if (!canControl || !connected) return;

    setError("");

    // Identity is already verified by the server
    // during join-room, so no userId is sent here.
    socket.emit("playback-control", {
      roomCode: room.code,
      action,
      ...extra,
    });
  }

  function selectTrack(index) {
    if (!canControl) return;

    const selected = queue[index];
    if (!selected) return;

    playQueueItem(selected.queueItemId);
  }

  function handleTrackEnded() {
    if (!canControl || !playback?.queueItemId) {
      return;
    }

    const currentIndex = queue.findIndex(
      (item) => item.queueItemId === playback.queueItemId,
    );

    if (currentIndex === -1) return;

    const nextSong = queue[currentIndex + 1];

    if (nextSong) {
      playQueueItem(nextSong.queueItemId);
    } else {
      sendPlaybackControl("pause");
    }
  }

  async function toggleHostControls() {
    if (!isHost || !connected || updatingPermissions || !token) {
      return;
    }

    setUpdatingPermissions(true);
    setError("");

    try {
      const response = await axios.patch(
        `${API_URL}/api/rooms/${room.code}/permissions`,
        {
          hostOnlyControls: !hostOnlyControls,
        },
        {
          headers: authHeaders,
        },
      );

      setHostOnlyControls(response.data.hostOnlyControls);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not update room permissions.",
      );
    } finally {
      setUpdatingPermissions(false);
    }
  }

  function sendMessage(event) {
    event.preventDefault();

    const text = messageInput.trim();

    if (!text || !connected) return;

    if (text.length > 500) {
      setChatError("Maximum 500 characters allowed.");
      return;
    }

    setChatError("");

    socket.emit("send-message", {
      roomCode: room.code,
      text,
    });

    setMessageInput("");
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <button className="back-link" onClick={onLeave} type="button">
            <ArrowLeft size={17} />
            Leave room
          </button>

          <div className="eyebrow">
            <span className="live-dot" />
            LIVE LISTENING ROOM
          </div>

          <h1>{room.name}</h1>

          <p className="muted">Welcome, {userName}. Your music, together.</p>
        </div>

        <div className="dashboard-info">
          {isHost && (
            <button
              type="button"
              className={`host-control-btn ${
                hostOnlyControls ? "host-control-on" : ""
              }`}
              onClick={toggleHostControls}
              disabled={updatingPermissions || !connected}
              title="Toggle host-only music controls"
            >
              <ShieldCheck size={16} />
              Host Only: {hostOnlyControls ? "ON" : "OFF"}
            </button>
          )}

          <div className="connection-status">
            {connected ? (
              <>
                <Wifi size={16} />
                Connected
              </>
            ) : (
              <>
                <WifiOff size={16} />
                Connecting...
              </>
            )}
          </div>

          <button className="room-invite" onClick={copyRoomCode} type="button">
            <span>ROOM CODE: {room.code}</span>

            {copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
        </div>
      </div>

      <style>{`
        .groovio-layout-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; align-items:start; }
        .groovio-layout-column { display:flex; flex-direction:column; gap:20px; min-width:0; }
        .groovio-layout-column > section { min-width:0; }
        .groovio-chat-launcher { position:fixed; bottom:22px; left:22px; z-index:1001; border:1px solid #d6fa72; border-radius:999px; padding:14px; display:flex; align-items:center; justify-content:center; background:#d6fa72; color:#1c211c; cursor:pointer; box-shadow:0 10px 30px #0008; }
        .groovio-chat-badge { position:absolute; top:-7px; right:-7px; background:#232a20; color:#d6fa72; border:1px solid #d6fa72; border-radius:999px; font-size:11px; min-width:22px; padding:3px; }
        .groovio-chat-popup { position:fixed; bottom:86px; left:22px; width:min(380px,calc(100vw - 44px)); height:min(510px,calc(100dvh - 120px)); z-index:1000; display:flex; flex-direction:column; box-shadow:0 18px 60px #000b; border:1px solid #4d5c3d; background:#171d18; }
        .groovio-chat-popup .chat-messages { flex:1; min-height:0; overflow-y:auto; }
        .groovio-chat-popup .chat-form { flex-shrink:0; }
        .groovio-chat-close { margin-left:auto; background:transparent; border:0; color:#e8f2df; font-size:26px; cursor:pointer; }
        @media (max-width:760px) { .groovio-layout-grid { grid-template-columns:minmax(0,1fr); } .groovio-chat-launcher { left:14px; bottom:14px; } .groovio-chat-popup { left:12px; bottom:76px; width:calc(100vw - 24px); } }
      `}</style>
      <div className="groovio-layout-grid">
        <div className="groovio-layout-column">
          {/* MUSIC PLAYER */}
          <section className="dashboard-panel player-panel">
            <div className="panel-heading">
              <Radio size={19} />
              <h2>Now Playing</h2>
            </div>

            <MusicPlayer
              track={currentTrack}
              playback={playback}
              canControl={canControl}
              onControl={sendPlaybackControl}
              onEnded={handleTrackEnded}
              onPlayTrack={() => currentTrack && playQueueItem(currentTrack.id)}
            />
          </section>

          {/* LIVE LISTENERS */}
          <section className="dashboard-panel members-panel">
            <div className="panel-heading">
              <Users size={19} />
              <h2>Listeners ({listeners.length})</h2>
            </div>

            {listeners.length === 0 ? (
              <p className="member-hint">Waiting for listeners to connect...</p>
            ) : (
              <div className="listeners-list">
                {listeners.map((listener) => (
                  <div className="member-entry" key={listener.userId}>
                    <span className="member-avatar">
                      {listener.name?.charAt(0).toUpperCase()}
                    </span>

                    <span className="listener-name">{listener.name}</span>

                    {listener.isHost && <Crown size={16} color="#d6fa72" />}

                    {listener.userId === userId && (
                      <span className="member-you">YOU</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <div className="groovio-layout-column">
          {/* YOUTUBE SEARCH: SEPARATE PANEL */}
          <section className="dashboard-panel search-panel">
            <div className="panel-heading">
              <Search size={19} />
              <h2>Search Songs</h2>
            </div>
            <div style={{ marginBottom: 24 }}>
              <form
                onSubmit={searchYouTube}
                style={{ display: "flex", gap: 10, marginBottom: 12 }}
              >
                <input
                  type="search"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search YouTube songs or artists..."
                  aria-label="Search YouTube"
                  maxLength={100}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "12px",
                    borderRadius: 10,
                    border: "1px solid #454b42",
                    background: "#1c211c",
                    color: "#f5f5f5",
                  }}
                />
                <button
                  type="submit"
                  disabled={searching || searchQuery.trim().length < 2}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: 0,
                    background: "#d6fa72",
                    color: "#1c211c",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  <Search size={16} />
                  {searching ? "Searching..." : "Search"}
                </button>
              </form>

              {searchError && (
                <p role="alert" style={{ color: "#ff8c8c" }}>
                  {searchError}
                </p>
              )}

              {!searching &&
                lastSearch &&
                !searchError &&
                searchResults.length === 0 && (
                  <p className="muted">No videos found for {lastSearch}.</p>
                )}

              {searchResults.length > 0 && (
                <div style={{ display: "grid", gap: 10 }}>
                  {searchResults.map((video) => (
                    <div
                      key={video.youtubeId}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        padding: 10,
                        border: "1px solid #3a4038",
                        borderRadius: 12,
                        background: "#1c211c",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => playSearchResult(video)}
                        disabled={!canControl || addingTrack}
                        aria-label={`Play ${video.title}`}
                        title="Play this song now"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          flex: 1,
                          minWidth: 0,
                          padding: 0,
                          border: 0,
                          background: "transparent",
                          color: "inherit",
                          textAlign: "left",
                          cursor: canControl ? "pointer" : "not-allowed",
                        }}
                      >
                        {video.thumbnail && (
                          <img
                            src={video.thumbnail}
                            alt=""
                            loading="lazy"
                            style={{
                              width: 90,
                              aspectRatio: "16 / 9",
                              objectFit: "cover",
                              borderRadius: 7,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 650,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {video.title}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {video.artist}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => addYouTubeTrack(video)}
                        disabled={!canControl || addingTrack}
                        title="Add YouTube video to queue"
                        aria-label={`Add ${video.title} to queue`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "9px 11px",
                          borderRadius: 9,
                          border: 0,
                          background: "#d6fa72",
                          color: "#1c211c",
                          cursor: canControl ? "pointer" : "not-allowed",
                          opacity: canControl && !addingTrack ? 1 : 0.5,
                          fontWeight: 700,
                        }}
                      >
                        <Plus size={16} /> Add
                      </button>
                      <button
                        type="button"
                        onClick={() => addYouTubeTrack(video, true)}
                        disabled={!canControl || addingTrack}
                        title="Insert immediately after the current song"
                        aria-label={`Play ${video.title} next`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "9px 11px",
                          borderRadius: 9,
                          border: "1px solid #d6fa72",
                          background: "transparent",
                          color: "#d6fa72",
                          fontWeight: 700,
                          cursor: canControl ? "pointer" : "not-allowed",
                          opacity: canControl && !addingTrack ? 1 : 0.5,
                        }}
                      >
                        <Play size={16} /> Play Next
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* SHARED QUEUE: SEPARATE PANEL BELOW SEARCH */}
          <section className="dashboard-panel queue-panel">
            <div className="panel-heading">
              <ListMusic size={19} />
              <h2>Queue ({queue.length})</h2>
              <button
                type="button"
                onClick={clearQueue}
                disabled={
                  !canDeleteQueue || clearingQueue || queue.length === 0
                }
                title={
                  canDeleteQueue
                    ? "Clear the entire queue"
                    : "Only the host can delete the queue while Host Only is ON"
                }
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: 0,
                  color: "#ff9696",
                  cursor: "pointer",
                  fontWeight: 700,
                  opacity:
                    !canDeleteQueue || clearingQueue || queue.length === 0
                      ? 0.4
                      : 1,
                }}
              >
                {clearingQueue ? "Deleting..." : "Delete Queue"}
              </button>
            </div>
            <div>
              {queue.length === 0 ? (
                <p className="muted">
                  Your queue is empty. Search for a song in the Search Songs
                  panel.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 9 }}>
                  {queue.map((item, index) => (
                    <div
                      key={item.queueItemId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 10,
                        borderRadius: 12,
                        border:
                          item.queueItemId === playback?.queueItemId
                            ? "1px solid #d6fa72"
                            : "1px solid #3a4038",
                        background: "#1c211c",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => playQueueItem(item.queueItemId)}
                        disabled={!canControl}
                        title="Play this song"
                        aria-label={`Play ${item.title}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          flex: 1,
                          minWidth: 0,
                          padding: 0,
                          border: 0,
                          background: "transparent",
                          color: "inherit",
                          textAlign: "left",
                          cursor: canControl ? "pointer" : "not-allowed",
                        }}
                      >
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt=""
                            loading="lazy"
                            style={{
                              width: 66,
                              aspectRatio: "16 / 9",
                              objectFit: "cover",
                              borderRadius: 7,
                            }}
                          />
                        ) : (
                          <Music2 size={24} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 650,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {item.title}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {item.artist}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={!canControl}
                        onClick={() => playQueueItem(item.queueItemId)}
                        aria-label={`Select ${item.title}`}
                        title="Select song"
                        style={{
                          background: "#d6fa72",
                          color: "#1c211c",
                          border: 0,
                          borderRadius: 9,
                          padding: 9,
                          cursor: canControl ? "pointer" : "not-allowed",
                          opacity: canControl ? 1 : 0.5,
                        }}
                      >
                        <Play size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {addingTrack && <p className="muted">Adding track...</p>}

            {isHost && <p className="member-hint">You are the room host.</p>}

            {!canControl && (
              <p className="member-hint">
                {connected
                  ? "Host-only controls are enabled. You can listen, but only the host can manage music."
                  : "Connect to the room to control music."}
              </p>
            )}
          </section>
        </div>
      </div>
      <button
        type="button"
        className="groovio-chat-launcher"
        aria-label={chatOpen ? "Close room chat" : "Open room chat"}
        onClick={() => setChatOpen((open) => !open)}
      >
        <MessageCircle size={24} />
        {!chatOpen && messages.length > 0 && (
          <span className="groovio-chat-badge">{messages.length}</span>
        )}
      </button>
      {chatOpen && (
        <section className="dashboard-panel chat-panel groovio-chat-popup">
          <div className="panel-heading">
            <MessageCircle size={19} />
            <h2>Room Chat</h2>

            <span className="chat-count">{messages.length} messages</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
              className="groovio-chat-close"
            >
              ×
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <MessageCircle size={30} />
                <p>No messages yet.</p>
                <span>Start the conversation!</span>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.userId === userId;

                return (
                  <div
                    key={message.id}
                    className={`chat-message ${
                      isOwn ? "chat-message-own" : ""
                    }`}
                  >
                    <div className="chat-message-meta">
                      <strong>{isOwn ? "You" : message.name}</strong>

                      <span>{formatMessageTime(message.createdAt)}</span>
                    </div>

                    <p>{message.text}</p>
                  </div>
                );
              })
            )}

            <div ref={chatBottomRef} />
          </div>

          <form className="chat-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder={
                connected ? "Type a message..." : "Connecting to chat..."
              }
              maxLength={500}
              disabled={!connected}
              aria-label="Chat message"
            />

            <button
              type="submit"
              disabled={!connected || !messageInput.trim()}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>

          {chatError && <p className="chat-error">{chatError}</p>}
        </section>
      )}

      {error && (
        <p
          style={{
            color: "#ff8c8c",
            textAlign: "center",
            padding: "12px",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
