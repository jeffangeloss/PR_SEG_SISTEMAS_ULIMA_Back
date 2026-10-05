// Lógica pura de estadísticas de sección (HU11). Sin BD ni efectos: promedio del
// salón, % de aprobados e histograma a partir de las notas OFICIALES ya
// calificadas (student_score). Testeable con `bun test`.

export type StatScoreRow = {
  enrollment_id: number;
  weight: number | string | null;
  value: number | string | null;
};

export type SectionStatistics = {
  promedioGeneral: number;
  porcentajeAprobados: number;
  rango0_10: number;
  rango11_13: number;
  rango14_16: number;
  rango17_20: number;
};

/** Nota aprobatoria (0..20). */
export const PASSING_GRADE = 10.5;

const emptyStats = (): SectionStatistics => ({
  promedioGeneral: 0,
  porcentajeAprobados: 0,
  rango0_10: 0,
  rango11_13: 0,
  rango14_16: 0,
  rango17_20: 0,
});

/**
 * Estadísticas del salón a partir de las notas ya calificadas.
 *
 * Por alumno: promedio ponderado sobre lo calificado (Σ nota·peso / Σ peso).
 * Sobre esos promedios: `promedioGeneral` (media), `porcentajeAprobados`
 * (promedio ≥ 10.5) e histograma por rango de la nota **redondeada**
 * (0-10, 11-13, 14-16, 17-20). Solo cuentan los alumnos con al menos una nota;
 * si nadie tiene notas, todo es 0.
 */
export function computeSectionStatistics(rows: StatScoreRow[]): SectionStatistics {
  const byEnrollment = new Map<number, { gradedWeight: number; weightedSum: number }>();
  for (const row of rows) {
    if (row.value == null) continue; // evaluación sin nota → no cuenta
    const weight = Number(row.weight ?? 0);
    const value = Number(row.value);
    const acc = byEnrollment.get(row.enrollment_id) ?? { gradedWeight: 0, weightedSum: 0 };
    acc.gradedWeight += weight;
    acc.weightedSum += value * weight;
    byEnrollment.set(row.enrollment_id, acc);
  }

  const promedios: number[] = [];
  for (const { gradedWeight, weightedSum } of byEnrollment.values()) {
    if (gradedWeight > 0) promedios.push(weightedSum / gradedWeight);
  }

  const n = promedios.length;
  if (n === 0) return emptyStats();

  const stats = emptyStats();
  stats.promedioGeneral = Math.round((promedios.reduce((a, b) => a + b, 0) / n) * 100) / 100;
  const aprobados = promedios.filter((p) => p >= PASSING_GRADE).length;
  stats.porcentajeAprobados = Math.round((aprobados / n) * 1000) / 10; // 1 decimal

  for (const p of promedios) {
    const r = Math.round(p);
    if (r <= 10) stats.rango0_10 += 1;
    else if (r <= 13) stats.rango11_13 += 1;
    else if (r <= 16) stats.rango14_16 += 1;
    else stats.rango17_20 += 1;
  }
  return stats;
}
