import { useState } from "react";
import { Plus, Music2, Play, Search, ListMusic } from "lucide-react";

import { tracks } from "../data/tracks";

export default function MusicQueue({
  queue = [],
  onAddTrack,
  onSelectTrack,
  canControl = true,
  currentQueueItemId = null,
}) {
  const [search, setSearch] = useState("");

  const filteredTracks = tracks.filter((track) =>
    `${track.title} ${track.artist}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="music-queue">
      <div className="music-search">
        <Search size={18} />

        <input
          type="text"
          placeholder="Search music..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <h3 className="queue-subtitle">MUSIC LIBRARY</h3>

      <div className="music-library">
        {filteredTracks.length === 0 ? (
          <p className="queue-empty">No matching tracks found.</p>
        ) : (
          filteredTracks.map((track) => (
            <div className="music-item" key={track.id}>
              <div className="music-item-icon">
                <Music2 size={19} />
              </div>

              <div className="music-item-info">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </div>

              <button
                className="music-add-btn"
                type="button"
                title={
                  canControl ? "Add to queue" : "Only the host can add songs"
                }
                onClick={() => onAddTrack(track)}
                disabled={!canControl}
              >
                <Plus size={19} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="queue-divider" />

      <h3 className="queue-subtitle">
        <ListMusic size={17} />
        UP NEXT ({queue.length})
      </h3>

      {queue.length === 0 ? (
        <p className="queue-empty">No tracks queued yet. Add something!</p>
      ) : (
        <div className="music-library">
          {queue.map((track, index) => {
            const isCurrent = track.queueItemId === currentQueueItemId;

            return (
              <div
                className="music-item"
                key={track.queueItemId || index}
                style={
                  isCurrent
                    ? {
                        borderColor: "#d6fa72",
                        background: "#26321f",
                      }
                    : {}
                }
              >
                <div className="music-item-icon">
                  <Music2 size={19} />
                </div>

                <div className="music-item-info">
                  <strong>
                    {track.title}
                    {isCurrent && " ♪"}
                  </strong>

                  <span>
                    {track.artist}
                    {isCurrent && " • Selected"}
                  </span>
                </div>

                <button
                  className="music-add-btn"
                  type="button"
                  title="Select this queue entry"
                  onClick={() => onSelectTrack(index)}
                  disabled={!canControl}
                >
                  <Play size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
