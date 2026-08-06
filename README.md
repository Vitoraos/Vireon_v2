<div align="center">

# 🩺 Vireon v2

**Voice-First Clinical Intake — From Speech to Care, in Seconds**

[![Live Demo](https://img.shields.io/badge/Live_Demo-vireon--v2--dpd1.vercel.app-2563EB?style=for-the-badge&logo=vercel)](https://vireon-v2-dpd1.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-404040?style=for-the-badge&logo=express)](https://expressjs.com/)

</div>

---

## 🌍 The Problem

In underserved and multilingual regions, accessing primary healthcare starts with a **broken intake process**:

- **Language barriers** — Patients code-switch between English, Pidgin, Yoruba, Hausa, and Swahili. Forms and chatbots can't keep up.
- **Typing friction** — Low-literacy or elderly patients struggle with text-based interfaces.
- **Triage delay** — Emergency symptoms get buried in long questionnaires instead of being surfaced immediately.
- **Doctor fatigue** — Clinicians spend 10–15 minutes per patient on repetitive history-taking before they can make a decision.

**Vireon v2** fixes this by letting patients *speak naturally* — in any language, with no app to install — and surfacing a structured, scannable report to the doctor in under a minute.

---

## ⚡ How It Works

```
┌─────────────┐     Voice      ┌──────────────┐     AI Interview      ┌─────────────┐
│   Patient   │ ─────────────> │   Backend    │ ───────────────────>  │  Structured  │
│  (Browser)  │   (Sahara STT) │  (Express)   │   (Qwen 3 / Groq)    │    Report    │
└─────────────┘                └──────────────┘                       └──────┬──────┘
       ^                                                                      │
       │                    Doctor Review & Action                             │
       │                     (Prescribe / Book / Emergency)                    │
       │                                                                      v
┌─────────────┐     TTS Playback    ┌──────────────┐     Response       ┌─────────────┐
│   Patient   │ <────────────────── │   Backend    │ <──────────────── │   Doctor    │
│  (Browser)  │   (Sahara TTS)      │  (Express)   │   (Dashboard)     │  (Browser)  │
└─────────────┘                     └──────────────┘                    └─────────────┘
```

### The Flow

| Step | What Happens | Tech |
|------|-------------|------|
| **1. Patient Speaks** | Holds a button, describes symptoms in *any* language or mix of languages. | **Sahara STT** (Intron Voice) |
| **2. Adaptive Interview** | AI asks follow-up questions to fill 5 clinical slots: duration, severity, associated symptoms, history, and anything else. | **Qwen 3** (via Groq / vLLM) |
| **3. Safety Check** | Deterministic red-flag detection (chest pain, bleeding, stroke signs, suicidal ideation) triggers an instant emergency recommendation. | Regex + LLM dual signal |
| **4. Report Generation** | A structured report is compiled and stored with a unique ID. | Backend orchestration |
| **5. Doctor Review** | Doctor opens the dashboard, sees the report, and selects an action: Prescribe, Request Appointment, or Recommend Emergency. | Next.js dashboard |
| **6. Patient Notification** | The doctor's decision + note is sent back to the patient, read aloud via voice. | **Sahara TTS** (Intron Voice) |

---

## 🎯 Key Features

### 🎙️ Voice-First, Zero Typing
- **Hold-to-speak** interaction model — no keyboards, no forms.
- Real-time **waveform visualization** during recording.
- Automatic **audio format negotiation** (WebM, MP4, OGG, WAV).

### 🌐 Multilingual & Code-Switching Native
- Patients can freely mix **English, Nigerian Pidgin, Yoruba, Hausa, Swahili**, and more.
- The AI **mirrors the patient's language pattern** in its spoken replies — it doesn't force pure English.
- Translation layer normalizes text for red-flag detection while preserving the original for the patient.

### 🚨 Emergency Red-Flag Detection
- **Dual-signal safety system**: deterministic keyword matching + LLM opinion.
- If triggered, the interview immediately stops and advises emergency care — no waiting for a doctor.

### 📋 Structured Clinical Reports
- Reports are **scannable, not scrollable** — segmented cards with left-border accents.
- Doctor sees: Chief Complaint, Duration, Severity (1–10), Associated Symptoms, Relevant History, and a full collapsible transcript.

### ⚡ Resilient by Design
- **Circuit breakers** on every external service (Qwen, Sahara STT, Sahara TTS, Translation).
- If an AI service fails, the system degrades gracefully to **fallback questions** instead of crashing.
- If TTS fails, the patient sees the text briefly and the flow continues.

---

## 🏗️ Architecture

### Frontend
| Layer | Tech |
|-------|------|
| Framework | **Next.js 14** (App Router) |
| Styling | **Tailwind CSS** — clinical, high-contrast design system |
| State Machine | Custom `useInterviewMachine` hook with pure reducer + side effects |
| Visualization | Canvas-based real-time waveform (Web Audio API) |

### Backend
| Layer | Tech |
|-------|------|
| Runtime | **Node.js** + **Express** |
| State | In-memory session store (Supabase-ready) |
| Validation | **Zod** schemas for all LLM outputs |
| Resilience | Custom circuit breaker + timeout wrappers |

### AI & Voice Stack
| Service | Provider | Role |
|---------|----------|------|
| **Speech-to-Text** | [Sahara (Intron)](https://intron.io) | Converts patient voice → text |
| **Text-to-Speech** | [Sahara (Intron)](https://intron.io) | Reads AI questions & doctor responses aloud |
| **Interview Logic** | Qwen 3 / Llama 3.1 (via Groq or vLLM) | Slot extraction, question generation |
| **Translation** | Llama 3.1 (via Groq) | Normalizes code-switched text for safety checks |

---

## 🔊 How We Used the Intron API

> **Intron's Sahara Voice API** is the sensory layer of Vireon. Without it, the product would be just another chatbot.

### Sahara STT (`/file/v1/upload` + `/file/v1/status`)
- **Batch-mode transcription** with polling — handles long-form patient monologues reliably.
- **Automatic language detection** — we don't force the patient to pick a language before speaking.
- **Resilient polling** — 26 attempts × 1.5s = 39s max wait, with clear status tracking (`FILE_PROCESSING` → `FILE_TRANSCRIBED`).

### Sahara TTS (`/tts/v1/enqueue`)
- **Asynchronous job queue** — we enqueue text, poll for completion, and stream audio back to the patient.
- **Voice matching** — `voice_accent`, `voice_gender`, and `voice_language` parameters let us match the assistant's voice to the patient's region and preference.
- **Multiple formats** — WAV for compatibility, OPUS for bandwidth savings.

### Why This Matters
In markets where literacy rates vary and patients are more comfortable speaking than typing, **voice is not a feature — it's the entire interface**. Intron's API let us build a product that feels like talking to a clinician, not filling out a form.

---

## 🚀 Live Demo

**🔗 [https://vireon-v2-dpd1.vercel.app](https://vireon-v2-dpd1.vercel.app)**

### Try It Yourself
1. **Patient flow**: Go to the homepage → click **"Start Consultation"** → hold the microphone button and describe a symptom (e.g., *"I have chest pain since morning"*).
2. **Doctor flow**: After submitting, copy the report ID from the success screen (or go directly to `/doctor` to see the latest report).
3. **Review & Respond**: Select an action (Prescribe / Appointment / Emergency), add a note, and submit.
4. **Patient receives**: The response appears on the patient's screen and is read aloud.

---

## 🛠️ Local Development

### Prerequisites
- Node.js 20+
- A Groq API key (or a local vLLM instance on `:8000`)
- A Sahara (Intron) API key

### 1. Clone & Install

```bash
git clone https://github.com/your-org/vireon-v2.git
cd vireon-v2

# Install frontend
cd frontend && npm install

# Install backend
cd ../Backend && npm install
```

### 2. Environment Variables

**Backend** (`.env`):
```bash
# --- Sahara (Intron Voice) ---
SAHARA_API_KEY=your_key_here
SAHARA_STT_BASE_URL=https://infer.voice.intron.io
SAHARA_TTS_BASE_URL=https://infer.voice.intron.io
SAHARA_STT_MODE=batch
SAHARA_TTS_MODE=batch
SAHARA_TTS_VOICE_ACCENT=american
SAHARA_TTS_VOICE_GENDER=female
SAHARA_TTS_VOICE_LANGUAGE=en
SAHARA_TTS_OUTPUT_FORMAT=wav

# --- Qwen 3 (via Groq) ---
QWEN_BASE_URL=https://api.groq.com/openai/v1
QWEN_API_KEY=gsk_your_key
QWEN_MODEL=llama-3.1-8b-instant
QWEN_STRUCTURED_MODE=json_schema
QWEN_TIMEOUT_MS=8000

# --- Translation ---
TRANSLATE_BASE_URL=https://api.groq.com/openai/v1
TRANSLATE_API_KEY=gsk_your_key
TRANSLATE_MODEL=llama-3.1-8b-instant

# --- Server ---
PORT=3001
```

**Frontend** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Run

```bash
# Terminal 1 — Backend
cd Backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:3001`

---

## 📡 API Contract (High Level)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transcribe` | `POST` | Upload audio blob → transcript |
| `/api/interview-turn` | `POST` | Send transcript → receive next question + slot updates |
| `/api/generate-report` | `POST` | Compile final structured report |
| `/api/reports/latest` | `GET` | Fetch most recent report (for doctor dashboard) |
| `/api/reports/:id` | `GET` | Fetch specific report |
| `/api/doctor-response` | `POST` | Submit doctor action + note |
| `/api/doctor-response/:id` | `GET` | Check if doctor has responded |
| `/api/tts` | `POST` | Synthesize text → audio bytes |

---

## 🧪 Design Principles

1. **Voice is the primary interface.** Everything else is a fallback.
2. **Safety never depends on one system.** Red flags are caught by both deterministic regex *and* LLM opinion.
3. **Degrade, don't crash.** If Qwen fails, fallback questions keep the interview moving. If TTS fails, text is shown. If STT fails, the patient re-records.
4. **Doctors own the decision.** The AI only gathers and structure — it never diagnoses or prescribes.
5. **Match the patient's language.** The AI mirrors code-switching patterns; it doesn't translate the patient back to themselves.

---

## 📄 License

MIT — built for the Intron x Groq Hackathon 2026.

---

<div align="center">

**Built with 🎙️ [Intron Voice](https://intron.io) · 🧠 [Groq](https://groq.com) · ⚡ [Next.js](https://nextjs.org)**

[🌐 Live Demo](https://vireon-v2-dpd1.vercel.app) · [🐛 Report Issue](../../issues) · [💡 Feature Request](../../issues)

</div>
