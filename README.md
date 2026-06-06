# Itinerary Agent

An AI-powered travel planning app that guides users through a quiz-style questionnaire and generates a personalized trip itinerary using an LLM. Authenticated users can save trips to a profile and export them directly into [TravelBin](https://github.com/qtran1018/TravelBin) as structured itinerary entries.

**Live:** [agent.quangntran.com](https://agent.quangntran.com) — part of the [travel platform portfolio](https://github.com/qtran1018/travel-platform-infra).

---

## Features

- **Guided quiz flow** — branching questions that adapt based on previous answers (destination, budget, trip length, style, companions, and more)
- **Multi-select and dropdown inputs** — checkbox, text, searchable country picker; free-text questions have character limits and live counters
- **Back navigation** — go back and change an answer; downstream answers clear to keep responses consistent
- **AI-generated itinerary** — answers compile into a structured prompt sent to OpenAI; response includes a trip title, markdown itinerary, and a structured entries array (name, type, location, notes)
- **Save + export** — authenticated users save trips to their profile; one click exports to TravelBin as pre-populated entry rows
- **Optional auth** — full quiz available without login; login/register via Keycloak SSO (shared with TravelBin and Splitpush)
- **Dark / light mode**, mobile-friendly layout

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vue 3, TypeScript, Vite, keycloak-js |
| Backend | Express 5, TypeScript, OpenAI SDK, Prisma 5, PostgreSQL |
| Auth | Keycloak 26 (optional; JWT validated via `jwks-rsa`) |
| Container | Docker + nginx (static build with `/api` proxy) |

---

## Project Structure

```
Itinerary-Agent/
├── itinerary-agent/              Vue 3 frontend (port 3010 Docker / 3000 local dev)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Quiz.vue          Main quiz UI + API calls
│   │   │   ├── Profile.vue       Saved trips page
│   │   │   └── AuthButton.vue    Login/Register/Logout in navbar
│   │   └── data/
│   │       ├── questions.ts      Question definitions + branching logic
│   │       ├── prompts.ts        Maps answers to OpenAI prompt fragments
│   │       └── types.ts          TypeScript interfaces
│   ├── Dockerfile                Multi-stage: node:20-alpine build → nginx:alpine serve
│   └── nginx.conf                Static server + /api proxy → itinerary-agent-backend:5000
│
├── itinerary-agent-backend/      Express 5 API (port 5000, internal only)
│   ├── server.ts                 Routes, auth middleware, OpenAI call
│   └── prisma/schema.prisma      Trip + TripEntry models
│
├── docker-compose.yml            Production build args (prod URLs baked into static build)
└── docker-compose.override.yml   Local dev (localhost URLs, auto-applied by plain `docker compose`)
```

---

## How It Works

1. User answers quiz questions (destination, style, budget, companions, etc.)
2. Each answer maps to a prompt fragment (`prompts.ts`); empty/skipped answers are filtered out
3. Frontend sends the assembled prompt to `POST /api/chat`
4. Backend calls OpenAI with a travel planner system prompt requesting structured JSON output: `{ title, markdown, entries }`
5. UI renders the markdown itinerary; the `entries` array (name, type, location, notes) powers Save and Export
6. Save → `POST /api/trips` stores trip in PostgreSQL via Prisma
7. Export → `POST /api/trips/:id/export` proxies to TravelBin's `/travel/destinations/import/` with the Bearer token forwarded

---

## Running Locally

### Prerequisites

- Node.js 20+, Docker + Docker Compose
- An OpenAI API key
- Keycloak running on port 8180 and PostgreSQL (shared via `keycloak-service/` and `postgres-service/`)
- Shared Docker network: `docker network create travelplatform-network`

### Docker (recommended, combined mode)

```bash
# From Itinerary-Agent/
docker compose build   # uses docker-compose.override.yml automatically (localhost URLs)
docker compose up -d

# First run — apply Prisma migrations
docker exec itinerary-agent-backend npx prisma migrate deploy
```

Frontend: http://localhost:3010

> Always use plain `docker compose` (no `-f`) for local dev. The override file sets `VITE_API_URL=http://localhost:5000` and `VITE_KEYCLOAK_URL=http://localhost:8180` baked into the static build. Running `docker compose -f docker-compose.yml` bakes production URLs instead.

### Local dev (no Docker)

```bash
# Backend
cd itinerary-agent-backend
npm install
# .env needs: OPENAI_API_KEY, DATABASE_URL=postgresql://...
npm run dev      # port 5000

# Frontend (separate terminal)
cd itinerary-agent
npm install
npm run dev      # port 3000
```

When running locally without Docker, `VITE_API_URL` is unset (empty string) so all fetch calls use relative `/api/...` paths proxied by Vite to `localhost:5000`.

### Test credentials

`test@example.com` / `password123` (username: `testuser`) — or register a new account; SSO works across all platform apps.

---

## Environment Variables

### Backend (`itinerary-agent-backend/.env`)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Required |
| `DATABASE_URL` | PostgreSQL connection string |
| `KEYCLOAK_ISSUER` | `http://localhost:8180/realms/travel-platform` (validates token `iss`) |
| `KEYCLOAK_JWKS_URL` | JWKS endpoint (optional; defaults to issuer URL; set to internal Docker URL in compose) |
| `TRAVELBIN_API_URL` | TravelBin backend URL for export proxy (`http://travelbin-backend:8000` in Docker) |

### Frontend build args (Docker)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL baked at build time. Empty string = Vite proxy (local dev); absolute URL = direct calls (prod) |
| `VITE_KEYCLOAK_URL` | Keycloak base URL baked at build time |

---

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/chat` | optional | OpenAI quiz → `{ title, reply, entries }` |
| GET | `/api/trips` | required | List saved trips |
| POST | `/api/trips` | required | Save trip |
| DELETE | `/api/trips/:id` | required | Delete trip |
| POST | `/api/trips/:id/export` | required | Export to TravelBin |
