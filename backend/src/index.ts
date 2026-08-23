import "dotenv/config";
import express from "express";
import cors from "cors";
import personaRouter from "./routes/persona.js";
import chatRouter from "./routes/chat.js";
import hintRouter from "./routes/hint.js";
import sessionRouter from "./routes/session.js";
import certificateRouter from "./routes/certificate.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/persona/generate", personaRouter);
app.use("/chat/turn", chatRouter);
app.use("/chat/hint", hintRouter);
app.use("/chat/session", sessionRouter);
app.use("/certificate/generate", certificateRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`mission-talk backend listening on :${port}`);
});
