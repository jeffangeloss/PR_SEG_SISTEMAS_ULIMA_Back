import { Hono } from "hono";
import type { Context } from "hono";
import { authMiddleware, requireRole } from "../../shared/middleware/auth-middleware.js";
import { chatbotRateLimit } from "../../shared/middleware/rate-limit.js";
import type { ChatbotController } from "./chatbot.controller.js";

export function createChatbotRoutes(controller: ChatbotController): Hono {
  const router = new Hono();

  router.use("*", authMiddleware);
  router.use("*", requireRole("student", "delegate", "subdelegate"));

  router.post("/sessions", (c: Context) => controller.createSession(c));
  router.get("/sessions", (c: Context) => controller.listSessions(c));
  router.get("/sessions/:id", (c: Context) => controller.getSession(c));
  router.delete("/sessions/:id", (c: Context) => controller.deleteSession(c));
  router.post("/sessions/:id/ask", chatbotRateLimit, (c: Context) => controller.ask(c));

  return router;
}
