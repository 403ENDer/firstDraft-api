import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import helmet from "helmet";
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
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

const upload = multer();

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/chat", upload.any(), chatRoutes);

app.get("/", (req, res) => {
  res.send("✅ VEO3 Script Generator API is running");
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
