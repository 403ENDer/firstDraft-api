import { Request, Response, NextFunction } from "express";
import { JWTPayload } from "../utils/types";
export interface AuthenticatedRequest extends Request {
    user?: JWTPayload;
}
export declare const jwtAuth: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=jwtAuth.d.ts.map