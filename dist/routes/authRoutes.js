"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authValidators_1 = require("../validators/authValidators");
const zodValidate_1 = require("../middleware/zodValidate");
const authRouter = (0, express_1.Router)();
authRouter.post("/signup", (0, zodValidate_1.zodValidate)(authValidators_1.signupSchema), authController_1.signup);
authRouter.post("/login", (0, zodValidate_1.zodValidate)(authValidators_1.signinSchema), authController_1.signin);
exports.default = authRouter;
//# sourceMappingURL=authRoutes.js.map