import express, {Request,Response} from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message } = req.body as { message: string };
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const completion = await client.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: "You are a helpful travel itinerary planner. Respond using Markdown formatting with headings and bold text for important points. Never ask follow-up questions. Never request clarification. Never suggest continuing the conversation. Never ask whether the user wants more information. Assume all required context is already provided. Respond once with the best possible final answer and stop."},
          { role: "user", content: message }
        ],
      });
      
      const reply = completion.choices[0].message?.content || "No reply";
      res.json({ reply: reply });
    }
    catch (error) {
      console.log(error)
      res.status(500).json({ error: "Something went wrong" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});