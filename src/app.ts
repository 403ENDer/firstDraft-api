import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import authRoutes from "./routes/authRoutes";
import chatRoutes from "./routes/chatRoutes";
import { connectDB } from "./config/database";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer();

app.use("/api/auth", authRoutes);
app.use("/api/chat", upload.any(), chatRoutes);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "localhost";
app.listen(PORT, HOST, () => {
  connectDB();
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
