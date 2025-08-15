import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { generateToken, verifyToken } from "../utils/jwt";
import { JWTPayload } from "../utils/types";

const formatUserResponse = (user: any) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

// Middleware to protect routes
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1]!;
  try {
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Signup handler
export const signup = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "User already exists" });
    }
    const user = new User({ name, email, password });
    await user.save();
    const payload: JWTPayload = {
      userId: user.id.toString(),
      email: user.email,
    };
    const token = generateToken(payload);

    res.status(201).json({
      user: formatUserResponse(user),
      token,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Signin handler
export const signin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "User with this email is not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const payload: JWTPayload = {
      userId: user.id.toString(),
      email: user.email,
    };
    const token = generateToken(payload);

    res.json({
      user: formatUserResponse(user),
      token,
    });
  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
