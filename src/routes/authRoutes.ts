import { Router } from "express";
import { signup, signin } from "../controllers/authController";
import { signupSchema, signinSchema } from "../validators/authValidators";
import { zodValidate } from "../middleware/zodValidate";

const authRouter = Router();

authRouter.post("/signup", zodValidate(signupSchema), signup);
authRouter.post("/login", zodValidate(signinSchema), signin);

export default authRouter;
