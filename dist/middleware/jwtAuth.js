"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtAuth = void 0;
const jwt_1 = require("../utils/jwt");
const jwtAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
            .status(401)
            .json({ message: "Missing or invalid Authorization header" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        req.user = payload;
        next();
    }
    catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.jwtAuth = jwtAuth;
//# sourceMappingURL=jwtAuth.js.map