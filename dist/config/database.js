"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
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
        await mongoose_1.default.connect(mongoURI);
        console.log("MongoDB connected successfully");
    }
    catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
//# sourceMappingURL=database.js.map