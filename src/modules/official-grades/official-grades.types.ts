// Sección que un docente puede calificar.
export interface TeacherGradingSection {
  sectionId: number;
  courseName: string;
  sectionCode: string;
  rol: "Profesor" | "JP";
}

// Grilla de calificación de una sección (roster × evaluaciones + notas puestas).
export interface SectionGradingGrid {
  sectionId: number;
  students: Array<{ enrollmentId: number; code: string; fullName: string }>;
  assessments: Array<{
    assessmentId: number;
    code: string;
    name: string;
    weight: number;
    weekNumber: number;
  }>;
  scores: Array<{ enrollmentId: number; assessmentId: number; value: number }>;
}

// Notas oficiales del alumno agrupadas por sección (para que el cliente calcule
// la nota final por ponderación, igual que la calculadora).
export interface StudentOfficialCourse {
  sectionId: number;
  courseName: string;
  sectionCode: string;
  assessments: Array<{
    assessmentId: number;
    code: string;
    name: string;
    weight: number;
    value: number | null;
  }>;
}
