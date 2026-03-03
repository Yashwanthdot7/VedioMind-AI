# 🎬 VideoMind AI

> Transform any YouTube video into AI-powered summaries, smart transcripts, and an interactive chat assistant — instantly.

![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue?style=flat-square&logo=react)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?style=flat-square&logo=node.js)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-orange?style=flat-square&logo=google)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

---

## ✨ Features

- 📝 **Smart Transcript** — Auto-generated, time-stamped, searchable transcript for any YouTube video
- 🧠 **AI Insights** — Concise summaries and key takeaways powered by Google Gemini
- 💬 **Chat with Video** — Ask questions about the video content and get instant AI answers
- ⚡ **Real-time Processing** — Animated progress overlay with step-by-step status updates
- 🎨 **Modern UI** — Sleek dark interface with smooth Framer Motion animations

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool & dev server |
| Tailwind CSS | Styling |
| Framer Motion | Animations |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| Google Generative AI (Gemini) | AI summarisation & chat |
| youtube-transcript | YouTube transcript extraction |
| ytdl-core / yt-dlp | Video metadata fetching |
| fluent-ffmpeg | Audio processing |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey) (free)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/videomind-ai.git
cd videomind-ai
```

### 2. Set Up the Backend

```bash
cd backend
npm install

# Create your environment file
cp .env.example .env
```

Open `backend/.env` and add your Gemini API key:

```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
```

Start the backend server:

```bash
npm run dev
```

The API will be available at `http://localhost:3001`

### 3. Set Up the Frontend

Open a new terminal:

```bash
cd Frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

---

## 📁 Project Structure

```
VideoMind AI/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── routes/           # API route definitions
│   │   ├── services/         # Business logic (Gemini AI, transcript)
│   │   ├── middleware/       # Error handling
│   │   ├── utils/            # Helper functions
│   │   ├── types/            # Shared constants
│   │   └── app.js            # Express app entry point
│   ├── .env.example          # Environment variable template
│   └── package.json
│
└── Frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Header.tsx         # URL input & navigation
    │   │   ├── VideoPlayer.tsx    # Embedded YouTube player
    │   │   ├── Transcript.tsx     # Smart transcript panel
    │   │   ├── AIInsights.tsx     # Summary & key takeaways
    │   │   ├── Chat.tsx           # Interactive Q&A chat
    │   │   └── ProcessingOverlay.tsx
    │   ├── services/
    │   │   └── apiService.ts      # Backend API calls
    │   ├── App.tsx                # Main layout & state
    │   └── types.ts               # TypeScript interfaces
    └── package.json
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/video/process` | Process a YouTube URL and return transcript + summary |
| `POST` | `/api/chat/ask` | Ask a question about the processed video |
| `GET` | `/api/health` | Health check |

---

## 🖼️ How It Works

1. **Paste** a YouTube URL into the search bar
2. VideoMind AI **fetches** the video transcript and metadata
3. **Google Gemini** analyses the content and generates a summary & key takeaways
4. Browse the **Smart Transcript**, read **AI Insights**, or **chat** directly with the video

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

Built with ❤️ using React, Node.js, and Google Gemini AI.
