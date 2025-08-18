import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import helmet from "helmet";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes";
import chatRoutes from "./routes/chatRoutes";
import { connectDB } from "./config/database";

dotenv.config();

const app = express();

// --- Security & Middleware ---
app.use(helmet()); // Adds secure HTTP headers
app.use(express.json());

// --- CORS: restrict in production ---
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
  console.log(process.env.MONGO_URI);
  res.send("VEO3 Script Generator API is running");
});

// Health check route to verify database connectivity
app.get("/health", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    const isConnected = dbState === 1;

    res.status(isConnected ? 200 : 503).json({
      status: isConnected ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus[dbState as keyof typeof dbStatus] || "unknown",
        connected: isConnected,
      },
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
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

// --- Server Listen ---
const PORT = Number(process.env.PORT) || 3333;
app.listen(PORT, "0.0.0.0", async () => {
  try {
    await connectDB();
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  }
});
