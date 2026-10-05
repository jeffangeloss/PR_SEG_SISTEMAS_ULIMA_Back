import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { EventBus } from "../../src/events/index.js";
import { GradesService } from "../../src/modules/grades/grades.service.js";
import type { GradesRepository } from "../../src/modules/grades/grades.repository.js";
import type { CourseRawRow } from "../../src/modules/grades/grades.types.js";
import { ChatbotRepository } from "../../src/modules/chatbot/chatbot.repository.js";

/**
 * Comportamientos que en v2.1.0 dependían del modo estático y que en la variante
 * de laboratorio quedan fijos, más una guarda sobre el código de src/.
 *
 * - Los sílabos se publican solo si el enlace es de Drive (la rama estática).
 * - El contexto del chatbot incluye las alertas de inasistencias, porque el
 *   riesgo de asistencia se conserva y las sigue creando (la rama dinámica).
 * - Los delegados del chatbot salen solo de `section_representative`.
 */

const dialect = new PgDialect();

/** `db` de mentira que guarda el SQL de cada consulta y devuelve `filas`. */
const capturador = (filas: unknown[] = []) => {
  const consultas: Array<{ sql: string; params: unknown[] }> = [];
  const database = {
    execute: async (q: SQL) => {
      consultas.push(dialect.sqlToQuery(q));
      return filas;
    },
  };
  return { consultas, database: database as never };
};

const filaCurso = (over: Partial<CourseRawRow>): CourseRawRow => ({
  course_id: 1,
  curriculum_course_id: null,
  course_name: "CURSO FICTICIO",
  period_code: "2026-2",
  section_id: null,
  section_code: null,
  assessment_id: null,
  assessment_name: null,
  assessment_code: null,
  syllabus_url: null,
  assessment_weight: null,
  assessment_type: null,
  ...over,
});

describe("GET /grades/me/courses: silaboUrl solo con enlaces de Drive", () => {
  test("una URL de cactus sale en null y una de Drive sale tal cual", async () => {
    const drive = "https://drive.google.com/file/d/abc123/view";
    const repositorio = {
      findCoursesAndAssessments: async () => [
        filaCurso({ course_id: 1, syllabus_url: "https://cactus.ulima.edu.pe/ac_bd001.nsf/x" }),
        filaCurso({ course_id: 2, syllabus_url: drive }),
        filaCurso({ course_id: 3, syllabus_url: null }),
      ],
    } as unknown as GradesRepository;

    const { cursos } = await new GradesService(repositorio, new EventBus()).getCoursesAndSyllabi();
    expect(cursos.map((c: { id: string; silaboUrl: string | null }) => [c.id, c.silaboUrl])).toEqual([
      ["1", null],
      ["2", drive],
      ["3", null],
    ]);
  });
});

describe("chatbot: contexto con el riesgo de asistencia y delegados reales", () => {
  test("getAlerts no descarta las alertas de inasistencias", async () => {
    const filas = [
      { type: "academic_risk", title: "Alerta de inasistencias - CURSO FICTICIO", message: "m", is_read: false, created_at: "2026-10-01" },
      { type: "academic_risk", title: "Riesgo Académico: CURSO FICTICIO", message: "m", is_read: false, created_at: "2026-09-30" },
    ];
    const { consultas, database } = capturador(filas);

    const alertas = await new ChatbotRepository(database).getAlerts(7);
    expect(alertas.map((a) => a.title)).toEqual(filas.map((f) => f.title));
    expect(consultas).toHaveLength(1);
    expect(consultas[0].sql).not.toContain("starts_with");
    expect(consultas[0].params).toEqual([7]);
  });

  test("getSectionRepresentatives solo lee section_representative", async () => {
    const { consultas, database } = capturador();

    await new ChatbotRepository(database).getSectionRepresentatives(7);
    expect(consultas).toHaveLength(1);
    expect(consultas[0].sql).toContain("section_representative sr");
    expect(consultas[0].sql).not.toContain("section_representative_claim");
  });
});

describe("guarda de código: src/ no se comunica con la ULima ni conserva el interruptor", () => {
  const archivos = [...new Glob("src/**/*.ts").scanSync(".")];

  test("hay archivos que revisar", () => {
    expect(archivos.length).toBeGreaterThan(50);
  });

  test("ningún import apunta a un módulo retirado", async () => {
    const retirados = /from\s+["'][^"']*(portal-sync|portal\.client|app-setting|public-config|academic-record)[^"']*["']/;
    const conImport: string[] = [];
    for (const archivo of archivos) {
      if (retirados.test(await Bun.file(archivo).text())) conImport.push(archivo);
    }
    expect(conImport).toEqual([]);
  });

  test("ningún archivo nombra los hosts de la ULima ni las variables retiradas", async () => {
    const prohibidos = [
      "webaloe.ulima",
      "cactus.ulima",
      "portalUL",
      "MODO_ESTATICO",
      "modoEstatico",
      "static_mode",
      "PORTAL_BASE_URL",
      "SYLLABUS_BASE_URL",
    ];
    const hallazgos: string[] = [];
    for (const archivo of archivos) {
      const texto = await Bun.file(archivo).text();
      for (const palabra of prohibidos) {
        if (texto.includes(palabra)) hallazgos.push(`${archivo}: ${palabra}`);
      }
    }
    expect(hallazgos).toEqual([]);
  });
});
