# DSA Memo — AI-Powered DSA Mentor

DSA Memo is a personal, browser-based study tool that makes Data Structures & Algorithms learning interactive. Paste any problem link or title and get a real AI mentor that adjusts how much it reveals based on how stuck you are — from a tiny nudge all the way to a full walkthrough.

Powered by **Groq** (`llama-3.3-70b-versatile`) for inference and **PlayAI TTS** for voice readback. Takeaways sync to your personal **Google Sheet** for long-term review.

---

## Features

**Progressive Hint System (5 levels)**
| Level | What you get |
|-------|-------------|
| 1 | A directional nudge — preserve the struggle |
| 2 | The core concept + a mini example from a similar problem |
| 3 | Logic error spotting on your code, or a deep theory breakdown |
| 4 | Full step-by-step algorithm, data structure choice, complexity |
| 5 | Complete solution (Python / C++), dry run, optimizations |

**AI Problem Normalizer** — paste a LeetCode URL, a problem title, or raw text. The model returns a structured card with statement, constraints, examples, difficulty, and tags.

**Streaming Chat** — hints stream token-by-token via Groq's streaming API so you're never waiting on a wall of text.

**Voice Readback** — click the speaker icon on any assistant message to hear it read aloud via Groq's PlayAI TTS.

**Knowledge Base** — after solving, hit "Capture Insight" to generate a structured takeaway (notes, concept, DSA category, importance rating). Edit inline, export as CSV, or sync directly to a Google Sheet.

**Session Analytics** — tracks time spent, hint levels used per session, and interview readiness score.

**Dark / Light mode** — full theme toggle, resizable split-screen workspace.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, TypeScript, Tailwind CSS |
| Build | Vite |
| AI Inference | Groq — `llama-3.3-70b-versatile` |
| TTS | Groq — `playai-tts` (Fritz-PlayAI voice) |
| Persistence | Google Sheets API v4 (Service Account JWT auth via Web Crypto) |
| Markdown | `marked` + `dompurify` |

---

## Prerequisites

- Node.js 18+
- A [Groq API key](https://console.groq.com/) (free tier works)
- A Google Cloud project with **Google Sheets API** enabled and a Service Account that has editor access to your sheet (only needed for the sync feature)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

```env
# Groq
GROQ_API_KEY=your_groq_api_key_here

# Google Sheets (optional — only needed for "Sync to Live Sheet")
GOOGLE_SERVICE_ACCOUNT_TYPE=service_account
GOOGLE_PROJECT_ID=your_project_id
GOOGLE_PRIVATE_KEY_ID=your_key_id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GOOGLE_CLIENT_CERT_URL=your_client_cert_url
GOOGLE_SHEET_ID=your_google_sheet_id
```

> The Google Sheets integration runs entirely client-side using Web Crypto API for JWT signing. This is intentional for a **personal / local tool** — do not deploy publicly with a service account key exposed.

### 3. Run

```bash
npm run dev
```

App starts at `http://localhost:3000`.

---

## Project Structure

```
DSAMemo/
├── components/
│   ├── ChatArea.tsx          # Streaming chat UI, voice readback
│   ├── Sidebar.tsx           # Problem input, session controls
│   ├── CodeWorkspace.tsx     # Code editor + problem description tabs
│   ├── TakeawaysModal.tsx    # Knowledge base — edit, export, sync
│   └── Analytics.tsx         # Session stats dashboard
├── geminiService.ts          # All Groq API calls
├── googleSheetsService.ts    # Google Sheets JWT auth + append logic
├── App.tsx                   # Root state, layout, orchestration
└── types.ts                  # Problem, ChatMessage, Takeaway, UserStats
```

---

## How It Works

```
User pastes problem
       |
normalizeProblem()  ->  Groq JSON mode  ->  structured Problem card
       |
User chats / requests hint
       |
getGuidedHintStream()  ->  Groq streaming  ->  token-by-token response
       |
User clicks "Capture Insight"
       |
generateTakeaway()  ->  Groq JSON mode  ->  notes, concept, category, stars
       |
"Sync to Live Sheet"  ->  JWT (Web Crypto)  ->  Google Sheets API batchUpdate
```

---

## Scripts

```bash
npm run dev      # dev server on :3000
npm run build    # production build
npm run preview  # preview production build
```
