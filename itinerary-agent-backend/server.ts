import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER || "http://localhost:8180/realms/travel-platform";
// In Docker the container can't reach localhost:8180 — use the internal network URL for JWKS
// while keeping KEYCLOAK_ISSUER as the public URL that tokens carry in their `iss` claim.
const KEYCLOAK_JWKS_URL = process.env.KEYCLOAK_JWKS_URL || `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`;
const TRAVELBIN_API_URL = process.env.TRAVELBIN_API_URL || "http://localhost:8000";

app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const prisma = new PrismaClient();

// ── Auth middleware ──────────────────────────────────────────────────────────

const jwksClient = jwksRsa({
  jwksUri: KEYCLOAK_JWKS_URL,
  cache: true,
  rateLimit: true,
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err || !key) return callback(err ?? new Error("No key found"));
    callback(null, key.getPublicKey());
  });
}

function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return next();
  const token = auth.split(" ")[1];
  jwt.verify(token, getSigningKey, { issuer: KEYCLOAK_ISSUER }, (err, decoded) => {
    if (!err && decoded) (req as any).user = decoded;
    next();
  });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) return res.status(401).json({ error: "Authentication required" });
  next();
}

app.use(optionalAuth);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip the place name from the start of its location string when OpenAI
 * redundantly includes it (e.g. name="Tiananmen Square",
 * location="Tiananmen Square, Beijing, China" → "Beijing, China").
 *
 * Handles compound names too: name="Wuhou Shrine & Jinli Ancient Street",
 * location="Jinli Ancient Street, Chengdu, China" → "Chengdu, China".
 */
function cleanLocation(name: string, location: string): string {
  if (!location) return location;
  const parts = location.split(",");
  if (parts.length <= 1) return location;
  const firstSegment = parts[0].trim().toLowerCase();
  const nameLower = name.trim().toLowerCase();
  const redundant =
    firstSegment === nameLower ||
    (firstSegment.length >= 5 && nameLower.includes(firstSegment));
  return redundant ? parts.slice(1).join(",").trim() : location;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ItineraryEntry {
  name: string;
  type: "Food & Drink" | "Shopping" | "Sightseeing" | "Activity" | "Other";
  location: string;
  notes: string;
  date?: string | null;
}

// ── /chat ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a helpful travel itinerary planner.

Your response MUST be a single valid JSON object with exactly three fields:

1. "title": A short, catchy trip name (3–7 words). It should read like a travel destination label, not a sentence. Examples: "3-Day Tokyo City Escape", "Budget Backpacking Southeast Asia", "Kyoto Hidden Gems Weekend", "Family Beach Week in Bali". Never use quotation marks inside the title value.

2. "markdown": A beautifully formatted Markdown travel itinerary with headings, bold highlights, and a clear day-by-day or section-by-section structure. Make it engaging and practical.

3. "entries": A JSON array of individual activities, attractions, restaurants, and experiences from the itinerary. Each entry must have exactly these five fields:
   - "name": Specific, recognisable name of the place or activity (e.g. "Senso-ji Temple", "Tsukiji Outer Market Breakfast")
   - "type": Exactly one of: "Food & Drink", "Shopping", "Sightseeing", "Activity", "Other"
   - "location": Specific location string, e.g. "Asakusa, Tokyo, Japan"
   - "notes": One concise, practical sentence — a tip, highlight, or what makes it worth visiting
   - "date": If the user's message includes a trip start date, assign a YYYY-MM-DD date to this entry based on which day of the itinerary it falls on (Day 1 = start date, Day 2 = start date + 1 day, etc.). If no start date was provided, set this field to null.

Guidelines for entries:
- Include 8–20 entries depending on trip length
- Do NOT include hotels, accommodation, transport, or airports as entries
- Use "Food & Drink" for restaurants, cafes, markets, and food experiences
- Use "Activity" for sports, tours, cooking classes, and hands-on experiences
- Use "Sightseeing" for landmarks, viewpoints, and attractions to observe
- Use "Shopping" for markets, shops, and retail experiences
- Use "Other" only if nothing else fits

Output ONLY the raw JSON object. No markdown code fences, no explanation before or after.

Example:
{"title":"3-Day Paris Itinerary","markdown":"# 3-Day Paris Itinerary\\n\\n## Day 1\\n...","entries":[{"name":"Eiffel Tower","type":"Sightseeing","location":"Champ de Mars, Paris, France","notes":"Go at dusk for stunning city views with the lights turning on.","date":"2026-07-14"}]}`;

app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { message } = req.body as { message: string };
    if (!message) return res.status(400).json({ error: "Message is required" });
    if (message.length > 2000) return res.status(400).json({ error: "Message too long" });

    const user = (req as any).user as jwt.JwtPayload | undefined;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message?.content || "{}";

    let title = "";
    let markdown = "";
    let entries: ItineraryEntry[] = [];

    try {
      const parsed = JSON.parse(raw);
      title = typeof parsed.title === "string" ? parsed.title.trim() : "";
      markdown = parsed.markdown ?? raw;
      entries = Array.isArray(parsed.entries)
        ? parsed.entries.map((e: ItineraryEntry) => ({
            ...e,
            location: cleanLocation(e.name, e.location),
            date: typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null,
          }))
        : [];
    } catch {
      markdown = raw;
      entries = [];
    }

    res.json({
      title,
      reply: markdown,
      entries,
      ...(user ? { savedFor: user.preferred_username ?? user.sub } : {}),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ── Trip CRUD ────────────────────────────────────────────────────────────────

app.get("/api/trips", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = ((req as any).user as jwt.JwtPayload).sub!;
    const trips = await prisma.trip.findMany({
      where: { userId },
      include: { entries: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

app.post("/api/trips", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = ((req as any).user as jwt.JwtPayload).sub!;
    const { title, destination, entries } = req.body as {
      title: string;
      destination: string;
      entries: ItineraryEntry[];
    };

    if (!title || !destination) {
      return res.status(400).json({ error: "title and destination are required" });
    }

    const trip = await prisma.trip.create({
      data: {
        userId,
        title,
        destination,
        entries: {
          create: (entries || []).map((e) => ({
            name: e.name,
            type: e.type,
            location: e.location,
            notes: e.notes ?? "",
            date: e.date ?? null,
          })),
        },
      },
      include: { entries: true },
    });

    res.status(201).json(trip);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/trips/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = ((req as any).user as jwt.JwtPayload).sub!;
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (trip.userId !== userId) return res.status(403).json({ error: "Not your trip" });

    await prisma.trip.delete({ where: { id } });
    res.json({ message: "Trip deleted" });
  } catch (err) {
    next(err);
  }
});

// ── TravelBin export ─────────────────────────────────────────────────────────

app.post("/api/trips/:id/export", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const userId = ((req as any).user as jwt.JwtPayload).sub!;
  const { id } = req.params;
  const token = req.headers.authorization?.split(" ")[1];

  let trip;
  try {
    trip = await prisma.trip.findUnique({ where: { id }, include: { entries: true } });
  } catch (err) {
    return next(err);
  }
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  if (trip.userId !== userId) return res.status(403).json({ error: "Not your trip" });

  try {
    const tbRes = await fetch(`${TRAVELBIN_API_URL}/travel/destinations/import/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: trip.title,
        entries: trip.entries.map((e) => ({
          name: e.name,
          type: e.type,
          location: e.location,
          notes: e.notes,
          date: e.date ?? null,
        })),
      }),
    });

    if (!tbRes.ok) {
      const err = await tbRes.text();
      return res.status(tbRes.status).json({ error: `TravelBin error: ${err}` });
    }

    const data = await tbRes.json();
    res.json({ destination_id: data.id, message: "Exported to TravelBin" });
  } catch (err) {
    console.error("TravelBin export error:", err);
    res.status(502).json({ error: "Could not reach TravelBin" });
  }
});

// ── Global error handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[unhandled error]", err);
  res.status(500).json({ error: "An unexpected error occurred." });
});

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
