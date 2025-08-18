"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signin = exports.signup = exports.authenticate = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
const formatUserResponse = (user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
});
// Middleware to protect routes
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = (0, jwt_1.verifyToken)(token);
        req.user = decoded;
        next();
    }
    catch (err) {
        console.error("JWT verification failed:", err);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.authenticate = authenticate;
// Signup handler
const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (await User_1.User.findOne({ email })) {
            return res.status(400).json({ message: "User already exists" });
        }
        const user = new User_1.User({ name, email, password });
        await user.save();
        const payload = {
            userId: user.id.toString(),
            email: user.email,
        };
        const token = (0, jwt_1.generateToken)(payload);
        res.status(201).json({
            user: formatUserResponse(user),
            token,
        });
    }
    catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.signup = signup;
// Signin handler
const signin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.User.findOne({ email });
        if (!user) {
            return res
                .status(400)
                .json({ message: "User with this email is not found" });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        const payload = {
            userId: user.id.toString(),
            email: user.email,
        };
        const token = (0, jwt_1.generateToken)(payload);
        res.json({
            user: formatUserResponse(user),
            token,
        });
    }
    catch (err) {
        console.error("Signin error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.signin = signin;
//# sourceMappingURL=authController.js.map