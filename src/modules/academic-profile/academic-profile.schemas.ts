import { z } from "zod";

export const specialtiesQuerySchema = z.object({
  careerId: z.string().optional(),
});

export const updateSpecialtiesSchema = z.object({
  primarySpecialtyId: z.number().int().positive().nullable().optional(),
  interestSpecialtyIds: z.array(z.number().int().positive()).optional().default([]),
});
