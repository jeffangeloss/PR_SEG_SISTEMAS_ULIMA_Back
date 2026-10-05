import { z } from "zod";

export const localGradeSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  notas: z.array(z.object({
    titulo: z.string(),
    peso: z.number(),
    valor: z.number().min(0).max(20),
  })),
});

export const askSchema = z.object({
  question: z.string().min(1, "La pregunta no puede estar vacia").max(500, "La pregunta no puede exceder 500 caracteres"),
  localGrades: z.array(localGradeSchema).optional(),
});

export type AskInput = z.infer<typeof askSchema>;
