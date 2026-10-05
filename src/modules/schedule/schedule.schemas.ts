import { z } from "zod";

export const academicPeriodQuerySchema = z.object({
  academicPeriodId: z.coerce.number().int().positive().optional(),
});
