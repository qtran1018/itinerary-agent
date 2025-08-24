import express, {Request,Response} from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message } = req.body as { message: string };
    const completion = await client.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: "You are a helpful travel itinerary planner that does not ask follow-up questions or for additional information. Respond using Markdown formatting with headings and bold text for important points."},
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});