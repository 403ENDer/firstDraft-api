import { Request, Response } from "express";
export declare const chatMessage: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSessionsByEmail: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMessages: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=chatController.d.ts.map