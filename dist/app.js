"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const helmet_1 = __importDefault(require("helmet"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const database_1 = require("./config/database");
dotenv_1.default.config();
const app = (0, express_1.default)();
// --- Security & Middleware ---
app.use((0, helmet_1.default)()); // Adds secure HTTP headers
app.use(express_1.default.json());
// --- CORS: restrict in production ---
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}));
const upload = (0, multer_1.default)();
// --- Routes ---
app.use("/api/auth", authRoutes_1.default);
app.use("/api/chat", upload.any(), chatRoutes_1.default);
app.get("/", (req, res) => {
    res.send("✅ VEO3 Script Generator API is running");
});
// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error("Server Error:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
});
// --- Server Listen ---
const PORT = Number(process.env.PORT) || 3333;
app.listen(PORT, "0.0.0.0", async () => {
    try {
        await (0, database_1.connectDB)();
        console.log(`Server running on port ${PORT}`);
    }
    catch (err) {
        console.error("Failed to connect to database:", err);
        process.exit(1);
    }
});
//# sourceMappingURL=app.js.map