import { z } from "zod";

export const calculateAverageSchema = z.object({
  notas: z.array(
    z.object({
      valor: z.number().min(0).max(20),
      peso: z.number().min(0).max(100),
    })
  ).min(0),
});

const notaEntrySchema = z.object({
  assessmentId: z.number().int().positive(),
  valor: z.number().min(0).max(20).nullable(),
});

const cursoNotasSchema = z.object({
  sectionId: z.number().int().positive(),
  notas: z.array(notaEntrySchema),
});

export const saveNotasSchema = z.object({
  cursos: z.array(cursoNotasSchema).min(1),
});

export const deleteNotaParamsSchema = z.object({
  sectionId: z.coerce.number().int().positive(),
  assessmentId: z.coerce.number().int().positive(),
});
