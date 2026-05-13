# Itinerary Agent

An AI-powered travel planning app that guides users through a quiz-style questionnaire and generates a personalized trip itinerary using an LLM. Built as a standalone tool and designed for future integration into a larger travel platform.

---

## Overview

Instead of staring at a blank text box, users answer a short series of questions about their travel preferences — destination, budget, trip length, travel style, and more. Their answers are assembled into a structured prompt and sent to an LLM, which returns a full, formatted itinerary.

The project is part of a broader travel platform that includes [TravelBin](#roadmap), an app where users can manually build and organize their itineraries. The goal is to eventually let this agent generate structured itinerary data that feeds directly into TravelBin.

---

## Demo

> Live demo: *(link here)*

![screenshot placeholder](https://via.placeholder.com/800x450?text=App+Screenshot)

---

## Features

- **Guided quiz flow** — branching questions that adapt based on previous answers (e.g. skip destination input if the user already knows where they want to go)
- **Multi-select and dropdown inputs** — handles checkbox selections, text input, and a searchable country picker
- **Back navigation** — users can go back and change an answer; downstream answers are cleared to keep responses consistent
- **AI-generated itinerary** — answers are compiled into a natural language prompt and sent to an LLM, which returns a markdown-formatted travel plan
- **Dark / light mode** — theme toggle, defaults to dark
- **Mobile-friendly** — responsive layout with touch-optimized inputs

---

## Tech Stack

**Frontend**
- [Vue 3](https://vuejs.org/) with Composition API and `<script setup>`
- TypeScript
- Vite
- [Marked](https://marked.js.org/) for rendering markdown responses

**Backend**
- Node.js + [Express](https://expressjs.com/)
- TypeScript
- [OpenAI SDK](https://platform.openai.com/docs/libraries)
- dotenv

**Infrastructure**
- Docker + Docker Compose (frontend on port 3010, backend on port 5000)
- Shared Docker network for multi-service travel platform integration

---

## Project Structure

```
Itinerary-Agent/
├── itinerary-agent/              # Vue 3 frontend
│   └── src/
│       ├── components/
│       │   └── Quiz.vue          # Main quiz UI and logic
│       └── data/
│           ├── questions.ts      # Question definitions and branching logic
│           ├── prompts.ts        # Maps user answers to prompt fragments
│           ├── country_list.ts   # Countries for dropdown
│           └── types.ts          # TypeScript interfaces
│
├── itinerary-agent-backend/      # Express API
│   └── server.ts                 # POST /chat endpoint → OpenAI
│
└── docker-compose.yml
```

---

## How It Works

1. The user works through a series of questions (destination, travel style, budget, companions, etc.)
2. Each answer maps to a natural language prompt fragment defined in `prompts.ts`
3. All fragments are joined into a single structured prompt
4. The frontend sends the prompt to the Express backend via `POST /api/chat`
5. The backend forwards it to the OpenAI API with a travel planner system prompt
6. The response (markdown) is rendered in the UI as the final itinerary

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- An OpenAI API key

### Running with Docker

```bash
# Clone the repo
git clone <repo-url>
cd Itinerary-Agent

# Add your OpenAI API key
echo "OPENAI_API_KEY=your_key_here" > itinerary-agent-backend/.env

# Start both services
docker compose up --build
```

The app will be available at `http://localhost:3010`.

### Running Locally (without Docker)

```bash
# Backend
cd itinerary-agent-backend
npm install
echo "OPENAI_API_KEY=your_key_here" > .env
npm run dev

# Frontend (in a separate terminal)
cd itinerary-agent
npm install
npm run dev
```

---

## Roadmap

This project is a module within a larger travel platform. Planned next steps:

- **Structured output** — prompt the LLM to return itinerary data as JSON (activities, destinations, dates, notes) rather than plain markdown
- **TravelBin integration** — send structured itinerary data via API to TravelBin, where users can view, edit, and manage their trip plans
- **Export options** — download the itinerary as a PDF or copy it to clipboard
- **Input sanitization** — harden the backend against prompt injection and add rate limiting
- **Saved preferences** — remember user preferences across sessions

---

## License

MIT
