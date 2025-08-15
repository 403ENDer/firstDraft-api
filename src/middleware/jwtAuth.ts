import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { JWTPayload } from "../utils/types";

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const jwtAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }
  const token = authHeader.split(" ")[1]!;
  try {
    const payload = verifyToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
