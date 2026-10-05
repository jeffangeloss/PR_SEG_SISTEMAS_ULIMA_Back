import { z } from "zod";

export const updateCourseProgressSchema = z.object({
  curriculumCourseId: z.number().int().positive(),
  status: z.enum(["locked", "available", "enrolled", "passed"]),
});

export const updateSimulationSchema = z.object({
  curriculumCourseId: z.number().int().positive(),
  // HU19: `simulated_available` = simular que un curso real aprobado/cursando
  // vuelve a estar disponible (des-aprobar) en el escenario "¿y si...?".
  status: z.enum(["planned", "simulated_completed", "simulated_available"]),
});
