import { z } from "zod";

export const chatTokenSchema = z.object({
  sectionId: z.coerce.number().int().positive(),
});

