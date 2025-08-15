import jwt from "jsonwebtoken";
import { JWTPayload } from "./types";

const JWT_SECRET: string = process.env.JWT_SECRET || "changeme";

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};
