import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  
  if (!mongoURI) {
    console.error("MONGO_URI environment variable is not set");
    process.exit(1);
  }

  // Validate connection string format
  if (!mongoURI.startsWith("mongodb://") && !mongoURI.startsWith("mongodb+srv://")) {
    console.error("Invalid MongoDB connection string format. Must start with 'mongodb://' or 'mongodb+srv://'");
    console.error("Current value:", mongoURI);
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
