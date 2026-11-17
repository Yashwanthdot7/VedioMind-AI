# 🎬 VideoMind AI

> Transform any YouTube video into AI-powered summaries, smart transcripts, and an interactive chat assistant — in 15 languages.

![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue?style=flat-square&logo=react)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?style=flat-square&logo=node.js)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-orange?style=flat-square&logo=google)
![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

---

## ✨ Features

- 📝 **Smart Transcript** — time-stamped, **searchable** transcript; click any line to jump the video there, and the line that's playing is highlighted
- 🧠 **AI Insights** — summary and key takeaways from Google Gemini
- 🌐 **15 output languages** — English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Urdu, Spanish, French, German, Arabic, Japanese
- 💬 **Chat with the video** — multi-turn conversation that remembers earlier questions; answers cite **clickable timestamps** like `[4:32]`
- 🎓 **Study Tools** — one click turns any video into:
  - 📒 **Notes** with sections, key terms and timestamps (download as Markdown)
  - ✅ **Quiz** — 8 multiple-choice questions with explanations and a score (printable with answer key)
  - 🃏 **Flashcards** — flip cards, shuffle, track what you know (export to Anki/Quizlet CSV)
  - 🧠 **Mind map** — see how the ideas connect, click a branch to jump to it (download as SVG)
  - Three levels: **Kids**, **Student** and **Teacher**, in any of the 15 languages
- 🎬 **Video lessons (text → video)**: type a topic, paste notes, or pick a YouTube video, and get a narrated, animated explainer video
  - AI-written scene script for **Kids**, **Students** or **Teachers**, in any of the 15 languages
  - AI narration (Gemini text-to-speech, free tier) with 6 voices, plus captions
  - **AI-generated pictures in every scene** (FLUX, free via Cloudflare Workers AI or Pollinations) with slow zoom-and-pan motion, or plain animated slides if you prefer
  - Six scene layouts (title, key points, big fact, steps, compare, recap) and a quiz at the end
  - **Download as MP4**, recorded in your browser (no server rendering and no cost)
  - If the free AI voice quota runs out, lessons still play using your **browser's built-in voice**
- 👤 **Accounts (Supabase)** — sign in with Google or email
- 📚 **My Library** — every video you summarise is saved with its chat history; search, favourite, or remove videos
- ⚡ **Shared cache** — a video is analysed once per language; the next request is instant and costs no AI calls
- 🛡️ **Rate limiting, input validation and clear error messages**

> Supabase is optional. Without it the app runs in **guest mode**: everything works, but nothing is saved.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide icons, react-youtube |
| Backend | Node.js, Express, express-rate-limit |
| AI | Google Gemini Flash (auto-selected, with fallback) — JSON-mode analysis, multi-turn chat, video transcription |
| Data | Supabase — Postgres, Auth (Google + email), Row Level Security |
| YouTube | Captions via `youtube-transcript` → `youtubei.js` → Gemini watching the video; metadata via youtubei.js → oEmbed |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) **v20.19+ or v22.12+** (required by Vite 8)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier works)
- *(Optional)* a free [Supabase](https://supabase.com) project

### 1. Clone

```bash
git clone https://github.com/Yashwanthdot7/VedioMind-AI.git
cd VedioMind-AI
```

### 2. Quick start (one command)

From the project root:

```bash
npm run setup     # installs root, backend and frontend dependencies (first time only)
npm run dev       # starts backend (:3001) and frontend (:5173) together
```

Create `backend/.env` and `Frontend/.env` first (see the tables below). Press `Ctrl+C` once to stop both.

Prefer separate terminals? Use the steps below.

### 2a. Backend (separately)

```bash
cd backend
npm install
cp .env.example .env     # then edit .env
npm run dev              # http://localhost:3001
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Your Gemini key |
| `GEMINI_MODEL` | | Model to try first. Empty = newest Flash, with automatic fallback if a model is retired |
| `PORT` | | Defaults to `3001` |
| `CORS_ORIGINS` | | Comma-separated allowed frontend URLs (default `http://localhost:5173`) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | optional | Free AI pictures (~170/day, no card). See below |
| `POLLINATIONS_TOKEN` | optional | Pictures work without it; a free token makes them faster |
| `SUPABASE_URL` | for accounts | Supabase → Project Settings → API |
| `SUPABASE_SECRET_KEY` | for accounts | The `sb_secret_…` key (or legacy `SUPABASE_SERVICE_ROLE_KEY`). **Server only — never put this in the frontend or commit it** |

### 2b. Frontend (separately)

```bash
cd Frontend
npm install
cp .env.example .env     # then edit .env
npm run dev              # http://localhost:5173
```

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend URL, e.g. `http://localhost:3001/api` |
| `VITE_SUPABASE_URL` | for accounts | Same project URL as the backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | for accounts | The public `sb_publishable_…` key (or legacy `VITE_SUPABASE_ANON_KEY`) |

### Free AI pictures for video lessons (optional, 5 minutes)

Pictures already work without any setup through **Pollinations.ai** (free, about one picture every 15 seconds). For faster pictures, add a free **Cloudflare** account:

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free plan, no credit card).
2. Go to **AI → Workers AI → Use REST API**.
3. Copy your **Account ID** and click **Create a Workers AI API Token**.
4. Put both in `backend/.env` as `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, then restart.

The free plan gives 10,000 Neurons a day, about 170 pictures (about 25 lessons). It resets at 05:30 IST, and going over the limit only falls back to Pollinations, never to a bill.

### 3. Supabase setup (optional, for accounts & library)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → URL Configuration**: set *Site URL* to your frontend URL (e.g. `http://localhost:5173`) and add it to *Redirect URLs*.
4. **Authentication → Providers → Google**: enable it and paste a Google OAuth client ID/secret ([guide](https://supabase.com/docs/guides/auth/social-login/auth-google)). Then set `VITE_ENABLE_GOOGLE_AUTH=true` in `Frontend/.env` to show the button. Email sign-in works without this step.
5. Put the URL and keys in both `.env` files and restart.

Then run `cd backend && npm run check:supabase`. It checks every table and storage bucket and tells you what is missing. The backend also logs `Supabase: connected` on start.

---

## 📁 Project Structure

```
VedioMind-AI/
├── backend/
│   ├── src/
│   │   ├── config/          # Supabase client, supported languages
│   │   ├── controllers/     # video, chat, library request handlers
│   │   ├── lib/             # AppError, in-memory LRU cache
│   │   ├── middleware/      # auth, rate limiting, error handling
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Gemini, YouTube, analysisStore (cache + Supabase)
│   │   ├── types/           # prompts and limits
│   │   ├── utils/           # input validation
│   │   └── app.js           # Express app entry point
│   └── test/                # node:test unit + API tests (YouTube & Gemini mocked)
├── Frontend/
│   └── src/
│       ├── components/      # Header, VideoPlayer, Transcript, AIInsights, Chat,
│       │                    # RichText, AuthModal, Library, ProcessingOverlay
│       ├── context/         # AuthContext (Supabase auth)
│       ├── constants/       # languages
│       ├── lib/             # supabase client, time helpers, errors
│       ├── services/        # apiService (backend calls)
│       └── App.tsx
└── supabase/
    └── schema.sql           # tables, RLS policies, storage buckets
```

---

## 🔌 API Endpoints

All endpoints accept an optional `Authorization: Bearer <supabase access token>` header.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | | Status, plus whether AI and database are configured |
| `GET` | `/api/languages` | | Supported output languages |
| `POST` | `/api/video/process` | optional | `{ url, language }` → transcript, summary, takeaways (cached; saved to library when signed in) |
| `POST` | `/api/video/info` | | `{ url }` → video metadata |
| `POST` | `/api/chat/conversation` | optional | `{ messages, analysisId?, videoId, language }` → answer (saved when signed in) |
| `POST` | `/api/chat/ask` | optional | Single question (legacy) |
| `POST` | `/api/study/:type` | optional | `type` = `notes` \| `quiz` \| `flashcards` \| `mindmap`. Body: `{ videoId, analysisId?, language, level?: kids\|student\|teacher, refresh? }`. Cached per video, language and level |
| `POST` | `/api/lessons` | optional | Create a video lesson: `{ text }` or `{ videoId, analysisId? }`, plus `audience`, `language`, `length: short\|standard`, `voice?`. Returns at once (status `queued`) |
| `GET` | `/api/lessons/:id` | owner | Lesson status/progress, or the full lesson when `done` |
| `GET` | `/api/lessons/:id/audio/:n` | owner | Narration WAV for scene `n` |
| `GET` | `/api/lessons` | required | Your lessons |
| `DELETE` | `/api/lessons/:id` | owner | Delete a lesson |
| `GET` | `/api/lessons/options` | | Voices and lengths |
| `GET` | `/api/library` | required | Your saved videos |
| `GET` | `/api/library/:analysisId` | required | Full analysis + saved chat |
| `PATCH` | `/api/library/:analysisId` | required | `{ isFavorite }` |
| `DELETE` | `/api/library/:analysisId` | required | Remove video and its chat |
| `DELETE` | `/api/library/:analysisId/chat` | required | Clear the chat only |

Errors are returned as `{ success: false, code, error }`, e.g. `NO_TRANSCRIPT`, `INVALID_URL`, `RATE_LIMITED`.

---

## 🧪 Tests

```bash
cd backend && npm test
cd Frontend && npm run typecheck && npm run lint
```

---

## ⚠️ Known limitations

- Transcripts are fetched from YouTube captions first. If YouTube blocks that (it often does since its 2025 changes) or the video has no captions, **Gemini watches the video and transcribes it**. This works for public videos up to 90 minutes and uses your Gemini quota (free tier: about 8 hours of YouTube video per day).
- Private and unlisted videos can't be processed.
- **Everything runs on free tiers.** Keep billing off on your Gemini key and you can never be charged: hitting a limit only returns "try again later". Video lesson audio is stored on your own disk in `backend/storage/` (not in Supabase), so it doesn't use your Supabase quota.
- MP4 export records in real time, so a 2-minute lesson takes about 2 minutes to save. Keep the tab open while it records. Chrome or Edge on Windows produce MP4; browsers that can't record MP4 save WebM instead.
- Debug a video from the command line: `npm run check:video --prefix backend -- "<YouTube URL>" --ai`

## 🗺️ Roadmap

- [x] Searchable transcript with click-to-seek
- [x] Multi-language summaries and chat
- [x] Supabase accounts, library and chat history
- [x] Study tools: notes, quiz, flashcards, mind map (Kids / Student / Teacher levels)
- [x] Text → explainer video for kids, students and teachers (multi-language narration, MP4 download)
- [x] AI transcription for videos without captions
- [ ] Deployment (Vercel + Render)

---

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👨‍💻 Author

**Yashwanth D** ([@Yashwanthdot7](https://github.com/Yashwanthdot7)) — built with React, Node.js, Supabase and Google Gemini.
