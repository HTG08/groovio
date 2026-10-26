import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Music2, Lock } from "lucide-react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

let youtubeApiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };

    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () =>
        reject(new Error("Could not load YouTube player API."));
      document.head.appendChild(script);
    }
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

function getTargetTime(playback) {
  if (!playback) return 0;
  const updated = new Date(playback.updatedAt || Date.now()).getTime();
  const elapsed =
    playback.isPlaying && Number.isFinite(updated)
      ? Math.max(0, (Date.now() - updated) / 1000)
      : 0;
  return Math.max(0, Number(playback.position || 0) + elapsed);
}

export default function MusicPlayer({
  track,
  playback,
  canControl = true,
  onControl,
  onEnded,
  onPlayTrack,
}) {
  const audioRef = useRef(null);
  const youtubeContainerRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const youtubeReadyRef = useRef(false);
  const playbackRef = useRef(playback);
  const onEndedRef = useRef(onEnded);
  const onControlRef = useRef(onControl);
  const canControlRef = useRef(canControl);
  const syncGuardRef = useRef(0);
  const lastNativePositionRef = useRef(null);
  const lastReportedSeekRef = useRef(0);
  const seekPendingRef = useRef(false);
  const [seekDraft, setSeekDraft] = useState(null);
  const seekDraftRef = useRef(null);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [error, setError] = useState("");
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const isYouTube = track?.source === "youtube";
  const youtubeId = isYouTube ? track?.youtubeId : null;

  playbackRef.current = playback;
  onEndedRef.current = onEnded;
  onControlRef.current = onControl;
  canControlRef.current = canControl;

  // Reset displayed progress when the selected queue entry changes.
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError("");
    setNeedsInteraction(false);
    lastNativePositionRef.current = null;
    lastReportedSeekRef.current = 0;
    seekPendingRef.current = false;
    seekDraftRef.current = null;
    setSeekDraft(null);
    syncGuardRef.current = Date.now() + 1500;
  }, [track?.id]);

  // Create and destroy the YouTube player when switching videos.
  useEffect(() => {
    if (!youtubeId || !youtubeContainerRef.current) return;
    let cancelled = false;
    let player;
    youtubeReadyRef.current = false;
    setYoutubeReady(false);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !youtubeContainerRef.current) return;
        const mount = document.createElement("div");
        youtubeContainerRef.current.replaceChildren(mount);
        player = new YT.Player(mount, {
          videoId: youtubeId,
          width: "100%",
          height: "240",
          playerVars: {
            playsinline: 1,
            controls: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              youtubePlayerRef.current = event.target;
              youtubeReadyRef.current = true;
              setYoutubeReady(true);
              event.target.setVolume(Math.round(volume * 100));
              setDuration(event.target.getDuration() || 0);
              syncGuardRef.current = Date.now() + 1500;
            },
            onStateChange: (event) => {
              if (cancelled) return;
              const state = event.data;
              if (state === YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setNeedsInteraction(false);
                setError("");
                if (
                  Date.now() > syncGuardRef.current &&
                  !playbackRef.current?.isPlaying
                ) {
                  if (canControlRef.current) {
                    onControlRef.current?.("play", {
                      position: event.target.getCurrentTime() || 0,
                    });
                  } else {
                    syncGuardRef.current = Date.now() + 1000;
                    event.target.pauseVideo();
                  }
                }
              } else if (state === YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                if (
                  Date.now() > syncGuardRef.current &&
                  playbackRef.current?.isPlaying
                ) {
                  if (canControlRef.current) {
                    onControlRef.current?.("pause", {
                      position: event.target.getCurrentTime() || 0,
                    });
                  } else {
                    syncGuardRef.current = Date.now() + 1000;
                    event.target.playVideo();
                  }
                }
              } else if (state === YT.PlayerState.ENDED) {
                setIsPlaying(false);
                onEndedRef.current?.();
              }
            },
            onError: () => {
              if (!cancelled)
                setError(
                  "This YouTube video cannot be played here. Try another video.",
                );
            },
          },
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load YouTube.");
      });

    return () => {
      cancelled = true;
      youtubeReadyRef.current = false;
      youtubePlayerRef.current = null;
      try {
        player?.destroy();
      } catch {
        /* Player may not be ready yet. */
      }
      if (youtubeContainerRef.current)
        youtubeContainerRef.current.replaceChildren();
    };
  }, [youtubeId]);

  // Apply volume to whichever player is active.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (youtubeReadyRef.current) {
      try {
        youtubePlayerRef.current?.setVolume(Math.round(volume * 100));
      } catch {
        /* ignore */
      }
    }
  }, [volume, youtubeReady]);

  // Keep YouTube aligned with the authoritative room playback state.
  useEffect(() => {
    if (!isYouTube || !youtubeReady || !playback || !youtubeReadyRef.current)
      return;
    const player = youtubePlayerRef.current;
    if (!player) return;

    try {
      // Acknowledge the latest authoritative server position.
      seekPendingRef.current = false;
      syncGuardRef.current = Date.now() + 2500;
      const target = getTargetTime(playback);
      const actual = player.getCurrentTime() || 0;
      // Avoid resynchronizing for tiny clock/buffering differences.
      if (Math.abs(actual - target) > 2.5) player.seekTo(target, true);

      if (playback.isPlaying) {
        player.playVideo();
        // Browser policies may prevent autoplay. The manual button below
        // remains available for listeners who need to enable playback.
        setNeedsInteraction(true);
      } else {
        player.pauseVideo();
        setNeedsInteraction(false);
      }
    } catch {
      setError("Could not synchronize YouTube playback.");
    }
  }, [
    isYouTube,
    youtubeReady,
    playback?.queueItemId,
    playback?.isPlaying,
    playback?.position,
    playback?.updatedAt,
  ]);

  // Keep local MP3s synchronized as before.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isYouTube || !track || !playback) return;
    let cancelled = false;

    async function syncPlayback() {
      const target = getTargetTime(playback);
      if (Math.abs(audio.currentTime - target) > 1) {
        try {
          audio.currentTime = target;
        } catch {
          /* metadata not ready */
        }
      }
      if (playback.isPlaying) {
        try {
          await audio.play();
          if (!cancelled) {
            setNeedsInteraction(false);
            setError("");
          }
        } catch {
          if (!cancelled) {
            setNeedsInteraction(true);
            setError("Browser blocked automatic playback. Click Enable Audio.");
          }
        }
      } else {
        audio.pause();
      }
    }

    syncPlayback();
    return () => {
      cancelled = true;
    };
  }, [
    isYouTube,
    track?.audioUrl,
    playback?.queueItemId,
    playback?.isPlaying,
    playback?.position,
    playback?.updatedAt,
  ]);

  // Update progress for the YouTube iframe (HTML audio has onTimeUpdate).
  useEffect(() => {
    if (!isYouTube || !youtubeReady) return;
    const timer = setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player || !youtubeReadyRef.current) return;
      try {
        const position = player.getCurrentTime() || 0;
        setCurrentTime(position);
        setDuration(player.getDuration() || 0);
        const state = player.getPlayerState();
        const previous = lastNativePositionRef.current;
        const now = Date.now();
        if (
          previous &&
          state === 1 &&
          now > syncGuardRef.current &&
          !seekPendingRef.current &&
          now - lastReportedSeekRef.current > 2500 &&
          Math.abs(
            position - previous.position - (now - previous.time) / 1000,
          ) > 3
        ) {
          if (canControlRef.current) {
            seekPendingRef.current = true;
            lastReportedSeekRef.current = now;
            syncGuardRef.current = now + 3000;
            onControlRef.current?.("seek", { position });
          } else {
            syncGuardRef.current = now + 3000;
            player.seekTo(getTargetTime(playbackRef.current), true);
          }
        }
        lastNativePositionRef.current = { position, time: now };
        if (playbackRef.current?.isPlaying && state === 5) {
          setNeedsInteraction(true);
        }
      } catch {
        /* iframe may be changing */
      }
    }, 500);
    return () => clearInterval(timer);
  }, [isYouTube, youtubeReady]);

  function commitSeek(value) {
    const target = Number(value);
    seekDraftRef.current = null;
    setSeekDraft(null);
    if (!canControl || !track || !Number.isFinite(target)) return;
    syncGuardRef.current = Date.now() + 3000;
    seekPendingRef.current = true;
    lastReportedSeekRef.current = Date.now();
    // Give instant local feedback; the server broadcasts the authoritative position.
    if (isYouTube && youtubeReadyRef.current) {
      try {
        youtubePlayerRef.current?.seekTo(target, true);
      } catch {
        /* ignore */
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
    onControlRef.current?.("seek", { position: target });
  }

  function requestControl(action, extra = {}) {
    if (!canControl || !track) return;
    onControl?.(action, extra);
  }

  async function enableAudio() {
    if (isYouTube) {
      try {
        const player = youtubePlayerRef.current;
        if (!player || !youtubeReadyRef.current) return;
        player.unMute();
        player.setVolume(Math.round(volume * 100));
        if (playbackRef.current?.isPlaying) player.playVideo();
        setNeedsInteraction(false);
        setError("");
      } catch {
        setError(
          "Could not start YouTube playback. Use the embedded player's Play button.",
        );
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (playbackRef.current?.isPlaying) await audio.play();
      setNeedsInteraction(false);
      setError("");
    } catch {
      setError("Could not start audio. Try again.");
    }
  }

  return (
    <div className="groovio-player">
      <audio
        ref={audioRef}
        src={!isYouTube ? track?.audioUrl || undefined : undefined}
        preload="auto"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          onEndedRef.current?.();
        }}
        onError={() => {
          if (track && !isYouTube) setError("Unable to load this track.");
        }}
      />

      {isYouTube && (
        <div style={{ width: "100%", margin: "14px 0", minHeight: 240 }}>
          <div ref={youtubeContainerRef} />
          <p className="member-hint">
            YouTube video playback uses the official embedded player.
          </p>
        </div>
      )}

      <div className="groovio-progress">
        <span>{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={Number.isFinite(duration) && duration > 0 ? duration : 0}
          step="0.1"
          value={Math.min(seekDraft ?? currentTime, duration || 0)}
          disabled={!track || !canControl}
          onChange={(event) => {
            const value = Number(event.target.value);
            seekDraftRef.current = value;
            setSeekDraft(value);
          }}
          onPointerUp={() => {
            if (seekDraftRef.current !== null) commitSeek(seekDraftRef.current);
          }}
          onKeyUp={(event) => {
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
                "PageUp",
                "PageDown",
              ].includes(event.key) &&
              seekDraftRef.current !== null
            )
              commitSeek(seekDraftRef.current);
          }}
          aria-label="Seek track"
        />
        <span>{formatTime(duration)}</span>
      </div>

      <div className="groovio-player-controls">
        <button
          type="button"
          className="groovio-play-button"
          disabled={!track || !canControl}
          onClick={() => requestControl(playback?.isPlaying ? "pause" : "play")}
          aria-label={playback?.isPlaying ? "Pause" : "Play"}
        >
          {canControl ? (
            playback?.isPlaying ? (
              <Pause size={25} fill="currentColor" />
            ) : (
              <Play size={25} fill="currentColor" />
            )
          ) : (
            <Lock size={23} />
          )}
        </button>
        <div className="groovio-volume">
          {volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </div>
      </div>

      <button
        type="button"
        className="groovio-track"
        disabled={!track || !canControl}
        onClick={() => onPlayTrack?.()}
        aria-label={track ? `Play ${track.title}` : "No song selected"}
        title="Click to play this song"
        style={{
          width: "100%",
          border: 0,
          background: "transparent",
          color: "inherit",
          textAlign: "left",
          cursor: canControl && track ? "pointer" : "default",
        }}
      >
        <div className="groovio-track-art">
          {track?.thumbnail ? (
            <img
              src={track.thumbnail}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "12px",
              }}
            />
          ) : (
            <Music2 size={48} />
          )}
        </div>
        <div>
          <span className="groovio-track-label">NOW PLAYING</span>
          <h3>{track?.title || "Nothing playing yet"}</h3>
          <p>{track?.artist || "Choose a song from the shared queue"}</p>
        </div>
      </button>

      {!canControl && (
        <p className="member-hint">
          <Lock size={14} style={{ display: "inline" }} /> Host-only playback
          controls may be enabled.
        </p>
      )}

      {needsInteraction && playback?.isPlaying && (
        <button
          type="button"
          className="groovio-play-button"
          onClick={enableAudio}
          style={{
            width: "auto",
            padding: "0 18px",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: "bold",
          }}
        >
          Enable Audio
        </button>
      )}
      {error && <p style={{ color: "#ff8c8c", fontSize: "13px" }}>{error}</p>}
    </div>
  );
}
