import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  console.log(mongoURI);
  if (!mongoURI) {
    console.error("MONGO_URI environment variable is not set");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};
