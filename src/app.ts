import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import mongoose from "mongoose";
import multer from "multer";
import authRoutes from "../routes/authRoutes";
import chatRoutes from "../routes/chatRoutes";
import { connectDB } from "../config/database";
import serverless from "serverless-http";

dotenv.config();

const app = express();

// --- Security & Middleware ---
app.use(helmet());
app.use(express.json());

// --- CORS ---
app.use(
  cors({
    origin: [process.env.HOSTED_URI!, process.env.LOCAL_URI!],
    credentials: true,
  })
);

const upload = multer();

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/chat", upload.any(), chatRoutes);

app.get("/", (req, res) => {
  res.send("VEO3 Script Generator API is running");
});

// --- Health check ---
app.get("/health", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({ dbState });
});

// --- Error Handling ---
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Server Error:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
);

// --- DB Connect ---
connectDB().catch((err) => {
  console.error("MongoDB connection failed:", err);
});

export default serverless(app);
