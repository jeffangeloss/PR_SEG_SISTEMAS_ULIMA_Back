/**
 * Datos SINTÉTICOS de la base de laboratorio (variante sin portal, ver LABORATORIO.md).
 *
 * Solo datos, sin E/S. Todas las personas son inventadas: códigos de alumno 2099xxxx,
 * cuentas docentes `lab.*`, correos @laboratorio.test y nombres que no corresponden a nadie.
 * El catálogo institucional (carrera, malla, cursos, requisitos, especialidades y tipos de
 * evaluación) NO vive aquí: sale de laboratorio.catalogo.json, sin tocarlo.
 *
 * Las contraseñas tampoco viven aquí. El runner las lee de LAB_PASSWORD_ALUMNO y
 * LAB_PASSWORD_DOCENTE, documentadas en .env.laboratorio.example.
 *
 * Los nombres siguen la forma en que la base guarda a las personas, APELLIDOS y después
 * NOMBRES con dos apellidos, para que `partirNombre` los corte igual que a los demás.
 */

export type Dia = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SesionLab = { dia: Dia; inicio: string; fin: string; aula: string };

export type DocenteLab = {
  clave: string;
  codigoDocente: string;
  nombre: string;
  correo: string;
  /** Código de app_user con el que entra, o null si es un docente sin cuenta. */
  cuenta: string | null;
};

export type SeccionLab = {
  codigo: string;
  /** Código del curso en el catálogo (course.code). */
  curso: string;
  docente: string;
  jp: string | null;
  color: string;
  sesiones: SesionLab[];
};

/** Perfil de asistencia de una matrícula. `normal` reparte pocas faltas de forma determinista. */
export type PerfilAsistencia = "normal" | "en_riesgo" | "impedido";

export type AlumnoLab = {
  codigo: string;
  nombre: string;
  /** student.current_level: el ciclo que cursa. */
  nivel: number;
  /** Códigos de sección (SeccionLab.codigo) con matrícula activa. Vacío: sin matrícula. */
  secciones: string[];
  /** Cursos del catálogo que el alumno desaprobó y no está llevando. */
  desaprobados: string[];
  /** Nombre de la especialidad principal, o null si no eligió. */
  especialidad: string | null;
  setupCompleto: boolean;
  /** Perfil de asistencia por sección; la que no aparece es `normal`. */
  asistencia: Record<string, PerfilAsistencia>;
  networking: boolean;
};

export type EvaluacionLab = {
  codigo: string;
  nombre: string;
  /** Nombre exacto del tipo en assessment_type del catálogo. */
  tipo: string;
  semana: number;
  peso: number;
  /** Si el docente ya publicó la nota en todas las secciones. */
  publicada: boolean;
};

export const DOMINIO_LAB = "@laboratorio.test";

export const PERIODO_LAB = {
  codigo: "2026-2",
  // Lunes de inicio del calendario 2026-2 que ya cita schedule.repository.ts.
  inicio: "2026-08-24",
  semanas: 16,
} as const;

/**
 * Semanas transcurridas mínimas con las que se calculan las horas de asistencia. Con menos,
 * ningún alumno alcanza a quedar en riesgo y /attendance-risk no tendría qué mostrar. Ver
 * `semanasTranscurridas` en laboratorio.logic.ts.
 */
export const SEMANAS_TRANSCURRIDAS_MINIMAS = 6;

export const DOCENTES_LAB: DocenteLab[] = [
  { clave: "docente1", codigoDocente: "LAB-DOC-01", nombre: "DOCENTE FICTICIA CARLA", correo: `docente1${DOMINIO_LAB}`, cuenta: "lab.docente1" },
  { clave: "jp1", codigoDocente: "LAB-JP-01", nombre: "PRACTICA FICTICIO DIEGO", correo: `jp1${DOMINIO_LAB}`, cuenta: "lab.jp1" },
  { clave: "docente3", codigoDocente: "LAB-DOC-03", nombre: "PROFESORA INVENTADA ELENA", correo: `docente3${DOMINIO_LAB}`, cuenta: null },
  { clave: "docente4", codigoDocente: "LAB-DOC-04", nombre: "PROFESOR INVENTADO FABIO", correo: `docente4${DOMINIO_LAB}`, cuenta: null },
];

/**
 * Una sección por curso. Cada sesión ocupa una franja que ninguna otra sección usa, así que
 * ninguna combinación de matrículas choca. Todas duran 2 h, dos veces por semana.
 */
export const SECCIONES_LAB: SeccionLab[] = [
  {
    codigo: "LAB-1", curso: "650015", docente: "docente1", jp: "jp1", color: "#E57373",
    sesiones: [
      { dia: 1, inicio: "08:00", fin: "10:00", aula: "Aula LAB-101" },
      { dia: 3, inicio: "08:00", fin: "10:00", aula: "Aula LAB-101" },
    ],
  },
  {
    codigo: "LAB-2", curso: "650022", docente: "docente3", jp: null, color: "#64B5F6",
    sesiones: [
      { dia: 1, inicio: "10:00", fin: "12:00", aula: "Aula LAB-102" },
      { dia: 3, inicio: "10:00", fin: "12:00", aula: "Aula LAB-102" },
    ],
  },
  {
    codigo: "LAB-3", curso: "650061", docente: "docente1", jp: null, color: "#81C784",
    sesiones: [
      { dia: 2, inicio: "08:00", fin: "10:00", aula: "Aula LAB-103" },
      { dia: 4, inicio: "08:00", fin: "10:00", aula: "Aula LAB-103" },
    ],
  },
  {
    codigo: "LAB-4", curso: "650070", docente: "docente4", jp: null, color: "#FFB74D",
    sesiones: [
      { dia: 2, inicio: "10:00", fin: "12:00", aula: "Aula LAB-104" },
      { dia: 4, inicio: "10:00", fin: "12:00", aula: "Aula LAB-104" },
    ],
  },
  {
    codigo: "LAB-5", curso: "650063", docente: "docente3", jp: null, color: "#BA68C8",
    sesiones: [
      { dia: 1, inicio: "14:00", fin: "16:00", aula: "Aula LAB-105" },
      { dia: 3, inicio: "14:00", fin: "16:00", aula: "Aula LAB-105" },
    ],
  },
  {
    codigo: "LAB-6", curso: "650065", docente: "docente4", jp: null, color: "#4DB6AC",
    sesiones: [
      { dia: 2, inicio: "14:00", fin: "16:00", aula: "Aula LAB-106" },
      { dia: 4, inicio: "14:00", fin: "16:00", aula: "Aula LAB-106" },
    ],
  },
  {
    codigo: "LAB-7", curso: "650062", docente: "docente1", jp: null, color: "#A1887F",
    sesiones: [
      { dia: 5, inicio: "08:00", fin: "10:00", aula: "Aula LAB-107" },
      { dia: 5, inicio: "14:00", fin: "16:00", aula: "Aula LAB-107" },
    ],
  },
];

/** Las mismas cuatro evaluaciones en cada sílabo; los pesos suman 100. */
export const EVALUACIONES_LAB: EvaluacionLab[] = [
  { codigo: "PC1", nombre: "Práctica calificada 1", tipo: "Práctica Calificada", semana: 4, peso: 20, publicada: true },
  { codigo: "EP", nombre: "Examen parcial", tipo: "Examen Parcial", semana: 8, peso: 30, publicada: false },
  { codigo: "PC2", nombre: "Práctica calificada 2", tipo: "Práctica Calificada", semana: 12, peso: 20, publicada: false },
  { codigo: "EF", nombre: "Examen final", tipo: "Examen Final", semana: 16, peso: 30, publicada: false },
];

const CICLO_6 = ["LAB-1", "LAB-2", "LAB-3", "LAB-4"];
const CICLO_7 = ["LAB-4", "LAB-5", "LAB-6", "LAB-7"];

export const ALUMNOS_LAB: AlumnoLab[] = [
  { codigo: "20990001", nombre: "PRUEBA LABORATORIO ANA", nivel: 6, secciones: CICLO_6, desaprobados: [], especialidad: "Ingeniería de Software", setupCompleto: true, asistencia: {}, networking: true },
  { codigo: "20990002", nombre: "DEMO FICTICIO BRUNO", nivel: 6, secciones: CICLO_6, desaprobados: [], especialidad: "Tecnologías de la Información", setupCompleto: true, asistencia: {}, networking: true },
  { codigo: "20990003", nombre: "ENSAYO SIMULADO CAMILA", nivel: 6, secciones: CICLO_6, desaprobados: [], especialidad: "Sistemas de Información", setupCompleto: true, asistencia: {}, networking: false },
  { codigo: "20990004", nombre: "MUESTRA INVENTADA DARIO", nivel: 6, secciones: CICLO_6, desaprobados: [], especialidad: "Desarrollo de Videojuegos", setupCompleto: true, asistencia: {}, networking: false },
  { codigo: "20990005", nombre: "EJEMPLO PILOTO ESTELA", nivel: 6, secciones: CICLO_6, desaprobados: [], especialidad: null, setupCompleto: true, asistencia: { "LAB-1": "en_riesgo" }, networking: false },
  { codigo: "20990006", nombre: "MAQUETA PRUEBA FELIPE", nivel: 6, secciones: CICLO_6, desaprobados: [], especialidad: null, setupCompleto: true, asistencia: { "LAB-1": "impedido" }, networking: false },
  { codigo: "20990007", nombre: "BOCETO DEMO GABRIELA", nivel: 6, secciones: CICLO_6, desaprobados: ["650058"], especialidad: null, setupCompleto: true, asistencia: {}, networking: false },
  { codigo: "20990008", nombre: "PLANTILLA ENSAYO HUGO", nivel: 6, secciones: CICLO_6, desaprobados: [], especialidad: null, setupCompleto: true, asistencia: {}, networking: false },
  { codigo: "20990009", nombre: "MODELO MUESTRA IRENE", nivel: 7, secciones: CICLO_7, desaprobados: [], especialidad: "Ingeniería de Software", setupCompleto: true, asistencia: {}, networking: true },
  { codigo: "20990010", nombre: "PROTOTIPO EJEMPLO JAVIER", nivel: 7, secciones: CICLO_7, desaprobados: [], especialidad: "Tecnologías de la Información", setupCompleto: true, asistencia: {}, networking: false },
  { codigo: "20990011", nombre: "SIMULACRO MAQUETA KARINA", nivel: 7, secciones: CICLO_7, desaprobados: [], especialidad: null, setupCompleto: false, asistencia: {}, networking: false },
  // Sin matrícula activa: su login responde 403 NOT_ENROLLED.
  { codigo: "20990012", nombre: "BORRADOR PLANTILLA LUIS", nivel: 6, secciones: [], desaprobados: [], especialidad: null, setupCompleto: false, asistencia: {}, networking: false },
];

export const REPRESENTANTES_LAB = [
  { seccion: "LAB-1", alumno: "20990001", cargo: "delegate" },
  { seccion: "LAB-1", alumno: "20990002", cargo: "subdelegate" },
] as const;

export const AVISO_LAB = {
  seccion: "LAB-1",
  alumno: "20990001",
  titulo: "Aviso de laboratorio",
  mensaje: "Mensaje de prueba del delegado. Los datos de esta base son sintéticos.",
};

export type AsesoriaLab = {
  seccion: string;
  docente: string;
  tipo: "recurring" | "extra";
  dia: Dia;
  inicio: string;
  fin: string;
  modalidad: "classroom" | "virtual" | "hybrid";
  aula: string | null;
  enlace: string | null;
  /** Semana del período de la asesoría extra; null en las recurrentes. */
  semana: number | null;
  cupo: number | null;
};

/** Las recurrentes cuelgan del curso (section_id NULL); la extra, de su sección. */
export const ASESORIAS_LAB: AsesoriaLab[] = [
  { seccion: "LAB-1", docente: "docente1", tipo: "recurring", dia: 2, inicio: "16:00", fin: "17:00", modalidad: "classroom", aula: "Aula LAB-101", enlace: null, semana: null, cupo: null },
  { seccion: "LAB-3", docente: "docente1", tipo: "recurring", dia: 4, inicio: "16:00", fin: "17:00", modalidad: "virtual", aula: null, enlace: "https://laboratorio.test/asesoria/1", semana: null, cupo: null },
  { seccion: "LAB-1", docente: "docente1", tipo: "extra", dia: 5, inicio: "16:00", fin: "17:00", modalidad: "hybrid", aula: "Aula LAB-101", enlace: "https://laboratorio.test/asesoria/2", semana: 9, cupo: 5 },
];

/** Confirmaciones de asistencia a la asesoría extra de LAB-1. */
export const RSVP_LAB = [{ seccion: "LAB-1", alumno: "20990003" }];

export const BLOQUES_LAB = [
  { alumno: "20990001", titulo: "Prácticas (ficticio)", color: "#455A64", dias: [2, 4], inicio: "18:00", fin: "20:00" },
];

/** Todo lo sintético en un solo valor, que es lo que reciben `validarDatos` y `planificar`. */
export const DATOS_LAB = {
  periodo: PERIODO_LAB,
  semanasTranscurridasMinimas: SEMANAS_TRANSCURRIDAS_MINIMAS,
  docentes: DOCENTES_LAB,
  secciones: SECCIONES_LAB,
  evaluaciones: EVALUACIONES_LAB,
  alumnos: ALUMNOS_LAB,
  representantes: REPRESENTANTES_LAB,
  aviso: AVISO_LAB,
  asesorias: ASESORIAS_LAB,
  rsvp: RSVP_LAB,
  bloques: BLOQUES_LAB,
};

export type DatosLab = typeof DATOS_LAB;
