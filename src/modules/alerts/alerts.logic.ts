// Lógica pura de alertas (HU08). Sin acceso a BD ni efectos: todo testeable con
// `bun test`. Aísla los umbrales de riesgo académico y la agregación de notas
// por curso para poder verificarlos (caja blanca: bordes de los umbrales).

/** Riesgo académico: avance evaluado (% de peso calificado) por encima de este umbral… */
export const ACADEMIC_RISK_MIN_PROGRESS = 55;
/** …y promedio personal (nota /20) por debajo de este otro. */
export const ACADEMIC_RISK_MAX_AVERAGE = 10.5;

/** Nota aprobatoria (0..20). Una nota final < a esto reprueba el curso. */
export const PASSING_GRADE = 10.5;
/** Riesgo CRÍTICO: si para aprobar el alumno necesitaría MÁS de esta nota en el
 *  peso restante (evaluaciones aún no publicadas), se le alerta. 15/20 en todo
 *  lo que falta ya es un escenario muy difícil de remontar. */
export const CRITICAL_REQUIRED_ON_REMAINING = 15;

export type ScoreRow = {
  course_id: number;
  course_name: string;
  assessment_id: number | null;
  assessment_weight: number | string | null;
  score_value: number | string | null;
};

export type CourseAggregate = {
  courseId: number;
  name: string;
  gradedWeight: number; // suma de pesos de las evaluaciones ya calificadas (%)
  weightedSum: number; // suma de (nota * peso)
  numExamenes: number;
  totalWeight: number; // suma de pesos de TODAS las evaluaciones (calificadas o no)
};

/** Agrupa las filas por curso y acumula peso calificado, suma ponderada y peso
 *  total. Cada `assessment_id` cuenta una sola vez para `totalWeight` (aunque
 *  aún no tenga nota); las notas suman a `gradedWeight`/`weightedSum`. */
export function aggregateCourseScores(rows: ScoreRow[]): CourseAggregate[] {
  const groups = new Map<number, CourseAggregate>();
  const seenAssessments = new Map<number, Set<number>>();
  for (const row of rows) {
    if (!groups.has(row.course_id)) {
      groups.set(row.course_id, {
        courseId: row.course_id,
        name: row.course_name,
        gradedWeight: 0,
        weightedSum: 0,
        numExamenes: 0,
        totalWeight: 0,
      });
      seenAssessments.set(row.course_id, new Set());
    }
    const g = groups.get(row.course_id)!;
    if (row.assessment_id !== null) {
      const weight = Number(row.assessment_weight || 0);
      // `totalWeight`: una vez por evaluación (haya nota o no) para conocer el
      // peso restante y calcular cuánto necesitaría el alumno para aprobar.
      const seen = seenAssessments.get(row.course_id)!;
      if (!seen.has(row.assessment_id)) {
        seen.add(row.assessment_id);
        g.totalWeight += weight;
      }
      if (row.score_value !== null) {
        const value = Number(row.score_value);
        g.gradedWeight += weight;
        g.weightedSum += value * weight;
        g.numExamenes += 1;
      }
    }
  }
  return [...groups.values()];
}

/** Promedio personal ponderado sobre lo ya calificado (0 si no hay avance). */
export function personalAverage(gradedWeight: number, weightedSum: number): number {
  return gradedWeight > 0 ? weightedSum / gradedWeight : 0;
}

/** True si el curso está en riesgo académico según ambos umbrales. */
export function isAcademicRisk(gradedWeight: number, weightedSum: number): boolean {
  return (
    gradedWeight > ACADEMIC_RISK_MIN_PROGRESS &&
    personalAverage(gradedWeight, weightedSum) < ACADEMIC_RISK_MAX_AVERAGE
  );
}

/**
 * Nota promedio que el alumno necesitaría en el peso AÚN NO calificado para
 * alcanzar la nota aprobatoria (`PASSING_GRADE`), asumiendo que lo restante se
 * evalúa como un bloque. Devuelve 0 si ya no queda peso por calificar.
 *
 * final = (weightedSum + reqAvg · pesoRestante) / totalWeight ≥ PASSING_GRADE
 *   ⇒ reqAvg ≥ (PASSING_GRADE · totalWeight − weightedSum) / pesoRestante
 *
 * Puede dar >20 (ya es imposible aprobar) o ≤0 (ya está aprobado pase lo que pase).
 */
export function requiredOnRemaining(gradedWeight: number, weightedSum: number, totalWeight: number): number {
  const remaining = totalWeight - gradedWeight;
  if (remaining <= 0) return 0;
  return (PASSING_GRADE * totalWeight - weightedSum) / remaining;
}

/**
 * True si el alumno está en riesgo CRÍTICO en el curso: hay al menos una nota
 * publicada, todavía queda peso por calificar, y para aprobar necesitaría más de
 * `CRITICAL_REQUIRED_ON_REMAINING` en todo lo restante. Sirve a media asignatura
 * (cuando `isAcademicRisk` aún no aplica por poco avance) para detectar a quienes
 * ya casi no pueden remontar.
 */
export function isCriticalRisk(gradedWeight: number, weightedSum: number, totalWeight: number): boolean {
  if (gradedWeight <= 0) return false; // sin ninguna nota aún no se puede evaluar
  if (totalWeight - gradedWeight <= 0) return false; // todo calificado: es aprobó/reprobó, no "necesita X"
  return requiredOnRemaining(gradedWeight, weightedSum, totalWeight) > CRITICAL_REQUIRED_ON_REMAINING;
}
