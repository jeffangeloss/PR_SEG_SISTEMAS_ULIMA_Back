import { Hono } from "hono";
import { z } from "zod";
import {
  authMiddleware,
  requireRole,
  STUDENT_ROLES,
  type AuthVariables,
} from "../../shared/middleware/auth-middleware.js";
import type { NetworkingController } from "./networking.controller.js";
import { HttpError } from "../../shared/errors/http-error.js";

const userParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const createNetworkingRoutes = (controller: NetworkingController) => {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.use("*", authMiddleware);
  app.use("*", requireRole(...STUDENT_ROLES, "teacher"));
  app.get("/me", (c) => controller.getMine(c));
  app.put("/me", (c) => controller.updateMine(c));
  app.get("/users/:userId", (c) => {
    const parsed = userParamsSchema.safeParse({ userId: c.req.param("userId") });
    if (!parsed.success) {
      throw new HttpError(400, "Parametros invalidos.", "INVALID_ROUTE_PARAMS", parsed.error.flatten());
    }
    return controller.getVisibleByUserId(c);
  });

  return app;
};
