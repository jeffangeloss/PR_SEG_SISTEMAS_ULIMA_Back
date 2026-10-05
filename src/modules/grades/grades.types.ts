export type GradeValue = number | null;

export type NotaInput = {
  valor: number;
  peso: number;
};

export type CalculateAverageResponse = {
  promedio: number;
  sumaPesos: number;
};

export type CourseRawRow = {
  course_id: number;
  curriculum_course_id: number | null;
  course_name: string;
  period_code: string;
  section_id: number | null;
  section_code: string | null;
  assessment_id: number | null;
  assessment_name: string | null;
  assessment_code: string | null;
  syllabus_url: string | null;
  assessment_weight: string | null;
  assessment_type: string | null;
};

export type NotaEntry = {
  assessmentId: number;
  valor: number | null;
};

export type CursoNotasEntry = {
  sectionId: number;
  notas: NotaEntry[];
};

export type SaveNotasRequest = {
  cursos: CursoNotasEntry[];
};

export type LoadNotasResponse = {
  cursos: CursoNotasEntry[];
};

export type StudentScoreRow = {
  section_id: number;
  assessment_id: number;
  value: string | null;
};
