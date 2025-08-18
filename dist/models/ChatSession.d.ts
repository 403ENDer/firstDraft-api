import mongoose, { Document } from "mongoose";
export interface IMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}
export interface IChatSession extends Document {
    sessionId: string;
    sessionTitle: string;
    userId: string;
    messages: IMessage[];
}
export declare const ChatSession: mongoose.Model<IChatSession, {}, {}, {}, mongoose.Document<unknown, {}, IChatSession, {}, {}> & IChatSession & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ChatSession.d.ts.map