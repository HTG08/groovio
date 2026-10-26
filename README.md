# 🎧 Groovio

**Good music hits different together.**

Groovio is a full-stack, real-time collaborative music room application built with **React, Node.js, Express, MongoDB, and Socket.IO**. Create a room, share its code with friends, search for YouTube videos, add tracks to a shared queue, and control playback together.

> **Project status:** Functional development build. Some YouTube playback synchronization edge cases remain under investigation.

## 📸 Screenshots

The screenshots below were captured during development and show the application at different stages. The interface may differ slightly from the latest code.

### Landing page
![Groovio landing page](screenshots/landing.png)

### Join a listening room
![Room join interface](screenshots/join-room.png)

### Early room and MP3 test-track prototype
![Early room and queue](screenshots/room-and-test-tracks.png)

### YouTube search and shared queue
![YouTube search and queue](screenshots/youtube-search-and-queue.png)

### Embedded YouTube player
![YouTube player](screenshots/youtube-player.png)

### Listeners and room interface
![Room listeners](screenshots/listeners-and-chat.png)

## ✨ Features

- **Room creation and joining:** Unique six-character room codes and host/member roles.
- **Live room presence:** See listeners as they join and leave.
- **YouTube search:** Search videos using the YouTube Data API v3; metadata is checked server-side before adding a video.
- **Embedded playback:** Play videos using the YouTube IFrame Player API.
- **Shared queue:** Add tracks, insert tracks with **Play Next**, and clear the queue.
- **Host Only toggle:** The host can restrict playback and queue controls, or allow room members to collaborate.
- **Real-time updates:** Socket.IO broadcasts queue, permission, and playback state changes.
- **Room chat:** Chat with other listeners using a floating chat interface.
- **Room authentication:** Room-specific JWTs verify members before protected actions.

## 🛠️ Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Real-time communication | Socket.IO |
| Authentication | JSON Web Tokens (JWT) |
| Music integration | YouTube Data API v3, YouTube IFrame Player API |
| Deployment plan | Vercel (frontend), Render (backend) |

## 🎵 About the Original Three Test Tracks

Before adding YouTube search, Groovio used **three bundled MP3 files** to test the music player and shared-queue workflow:

| Track ID | Display name | File |
| --- | --- | --- |
| `track1` | SoundHelix Song 1 | `client/public/music/track1.mp3` |
| `track2` | SoundHelix Song 2 | `client/public/music/track2.mp3` |
| `track3` | SoundHelix Song 3 | `client/public/music/track3.mp3` |

These sample tracks helped develop and test track selection, queue operations, and playback controls **before** the YouTube integration was implemented. They are intentionally still present in the project, and the backend continues to support `mp3` queue items alongside `youtube` items. They are development/demo assets, not the primary music catalog.

## 🐛 Bugs and Improvements Addressed During Development

| Issue | Change made |
| --- | --- |
| **Room control permissions were inconsistent** | Added backend permission checks for authenticated room members and the Host Only setting. |
| **Members couldn't clear the queue even with Host Only OFF** | Updated the queue-deletion endpoint so members can clear the queue when collaboration is enabled; the host retains control when Host Only is ON. |
| **Queue deletion left playback active** | Clearing the queue now resets the selected song, playback position, and playing state, then broadcasts queue and playback updates. |
| **Song selection and Play could conflict** | Introduced an atomic `select-and-play` playback action to reduce select/play ordering races. |
| **Play Next needed to respect the current song** | Added queue insertion immediately after the current playback item, with a fallback when nothing is selected. |
| **Search results remained after clearing the query** | Updated the frontend search behavior to clear stale results when the search field is emptied. |
| **Room layout and controls were cluttered** | Refined the search/queue layout, introduced floating chat, and simplified informational text in the room UI. |

These describe implementation fixes made during development, not a claim that every edge case has been exhaustively tested.

## ⚠️ Known Limitations

- **Replay after a YouTube video ends:** Replaying a finished video can behave inconsistently because of end-position state handling.
- **Cross-device YouTube seeking:** A seek made through one player's native controls may not always propagate correctly to another device.
- **Autoplay and buffering:** Browser autoplay rules and network conditions can affect synchronization.
- **In-memory chat:** If chat messages are only held in server memory, restarting the backend can clear the chat history.
- **Free hosting:** A free backend service may sleep when idle, delaying the first connection.

## 📁 Project Structure

```text
groovio/
├── client/
│   ├── public/
│   │   └── music/                 # Three original MP3 demo tracks
│   ├── src/
│   │   ├── components/            # Player, queue, chat, listeners
│   │   ├── pages/                 # Room page
│   │   └── services/              # Socket.IO client
│   └── package.json
├── server/
│   ├── controllers/              # Room and YouTube handlers
│   ├── models/                   # MongoDB room schema
│   ├── routes/                   # REST API routes
│   ├── utils/                    # Room JWT helpers
│   ├── index.js                  # Express and Socket.IO server
│   └── package.json
├── screenshots/                   # Development screenshots
├── .gitignore
└── README.md
```

## 🚀 Run Locally

### Requirements

- Node.js and npm
- MongoDB Atlas connection string
- YouTube Data API v3 key

### 1. Clone the repository

```bash
git clone https://github.com/HTG08/groovio.git
cd groovio
```

### 2. Set up the backend

```bash
cd server
npm install
```

Create `server/.env` and set the environment variables expected by your server:

```env
PORT=8888
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
YOUTUBE_API_KEY=your_youtube_data_api_key
CLIENT_URL=http://localhost:5173
```

> Check `server/index.js` and `server/utils/roomAuth.js` for the exact variable names used in your local version. Never commit the real `.env` file.

Start the backend:

```bash
node index.js
```

### 3. Set up the frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`). If the client uses an environment variable for the backend URL, configure it to point to `http://localhost:8888` before starting Vite.

## 🔌 REST API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/rooms/create` | Create a room |
| `POST` | `/api/rooms/join` | Join a room |
| `GET` | `/api/rooms/:code` | Get room information |
| `GET` | `/api/rooms/youtube/search` | Search YouTube videos |
| `POST` | `/api/rooms/:code/queue` | Add a track or Play Next |
| `DELETE` | `/api/rooms/:code/queue` | Clear the queue |
| `PATCH` | `/api/rooms/:code/permissions` | Update Host Only setting |

## 🔐 Security and Permissions

- Room membership is verified with a JWT on protected queue and permission routes.
- The backend enforces Host Only restrictions; hiding controls in the UI is not the only protection.
- YouTube API keys and database credentials belong on the backend, not in frontend source code.
- The YouTube integration uses the official embedded player rather than downloading audio.

## 🌐 Deployment

The project is structured for a **Vercel frontend**, **Render backend**, and **MongoDB Atlas database**. Configure the production frontend/backend URLs and CORS before testing rooms across devices.

- **GitHub:** https://github.com/HTG08/groovio
- **Live demo:** Add your deployed Vercel URL here after deployment.

## 🔭 Future Improvements

- Fix end-of-video replay and improve cross-device seek synchronization.
- Persist chat history.
- Improve reconnection handling and mobile responsiveness.
- Add saved playlists and room management features.

## 👨‍💻 Author

Built by [HTG08](https://github.com/HTG08) as a full-stack MERN and real-time communication project.
