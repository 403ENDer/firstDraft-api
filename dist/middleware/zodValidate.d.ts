import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
export declare const zodValidate: (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=zodValidate.d.ts.map