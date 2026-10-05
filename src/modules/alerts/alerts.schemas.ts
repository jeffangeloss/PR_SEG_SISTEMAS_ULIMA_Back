import { z } from "zod";

export const markAlertReadSchema = z.object({
  alertId: z.number().int().positive(),
});
