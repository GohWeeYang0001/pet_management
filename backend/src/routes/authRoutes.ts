import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { login, logout, currentUser } from "../controllers/authController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { message: "Too many login attempts. Please try again later." },
});
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, currentUser);
export default router;
