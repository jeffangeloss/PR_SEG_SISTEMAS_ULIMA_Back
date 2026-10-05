import { z } from "zod";

// Param de sección en rutas docentes.
export const sectionIdParamSchema = z.object({
  sectionId: z.coerce.number().int().positive(),
});

// Una calificación oficial: matrícula del alumno + evaluación + nota 0..20.
export const officialScoreEntrySchema = z.object({
  enrollmentId: z.number().int().positive(),
  assessmentId: z.number().int().positive(),
  value: z.number().min(0).max(20),
});

// El profesor guarda varias notas de su sección a la vez.
export const upsertSectionScoresSchema = z.object({
  scores: z.array(officialScoreEntrySchema).min(1).max(1000),
});

export type OfficialScoreEntry = z.infer<typeof officialScoreEntrySchema>;
