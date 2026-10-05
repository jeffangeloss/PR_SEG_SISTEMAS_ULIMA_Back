import { describe, expect, test } from "bun:test";
import { getTableColumns } from "drizzle-orm";
import * as schema from "../../src/db/schema/schema.js";

/**
 * drizzle/0017_laboratorio_sin_portal.sql y src/db/schema/schema.ts dicen lo mismo.
 *
 * El .sql se lee como texto plano: esta prueba NO aplica la migración ni toca la base.
 * Aplicarla es del dueño, y solo contra la base del laboratorio.
 */
const migracion = await Bun.file("drizzle/0017_laboratorio_sin_portal.sql").text();

/** El SQL sin los comentarios `--`, para que una palabra dentro de un comentario no cuente. */
const codigo = migracion
  .split("\n")
  .map((linea) => linea.replace(/--.*$/, ""))
  .join("\n");

const TABLAS_RETIRADAS = [
  "student_portal_score",
  "section_representative_claim",
  "student_record_entry",
  "student_academic_snapshot",
  "student_period_summary",
  "course_equivalence",
  "app_setting",
];

const COLUMNAS_RETIRADAS_DE_ENROLLMENT = ["final_grade", "portal_grades_read_at", "portal_attendance_read_at"];

describe("drizzle/0017_laboratorio_sin_portal.sql", () => {
  test("borra las siete tablas, cada una con IF EXISTS", () => {
    for (const tabla of TABLAS_RETIRADAS) {
      expect(codigo).toContain(`DROP TABLE IF EXISTS ${tabla};`);
    }
    expect(codigo.split("DROP TABLE").length - 1).toBe(TABLAS_RETIRADAS.length);
  });

  test("borra las tres columnas de enrollment y course.weekly_hours, con IF EXISTS", () => {
    for (const columna of COLUMNAS_RETIRADAS_DE_ENROLLMENT) {
      expect(codigo).toContain(`DROP COLUMN IF EXISTS ${columna}`);
    }
    expect(codigo).toContain("ALTER TABLE course DROP COLUMN IF EXISTS weekly_hours;");
    expect(codigo.split("DROP COLUMN").length - 1).toBe(4);
  });

  test("borra por nombre los dos CHECK de las columnas retiradas", () => {
    expect(codigo).toContain("ALTER TABLE enrollment DROP CONSTRAINT IF EXISTS chk_enrollment_final_grade;");
    expect(codigo).toContain("ALTER TABLE course DROP CONSTRAINT IF EXISTS chk_course_weekly_hours;");
    expect(codigo.split("DROP CONSTRAINT").length - 1).toBe(2);
  });

  test("conserva la asistencia: no toca las horas de enrollment ni course_offering", () => {
    for (const columna of ["attended_hours", "absent_hours", "total_hours"]) {
      expect(codigo).not.toContain(columna);
    }
    expect(codigo).not.toContain("course_offering");
  });

  test("no usa CASCADE ni crea nada", () => {
    expect(codigo).not.toContain("CASCADE");
    expect(codigo).not.toContain("CREATE");
  });

  test("el encabezado dice cómo se aplica y que es solo para el laboratorio", () => {
    expect(migracion).toContain("bun run db:apply drizzle/0017_laboratorio_sin_portal.sql");
    expect(migracion).toContain("SOLO para la base del laboratorio. NUNCA contra la base de producción");
  });
});

describe("src/db/schema/schema.ts alineado con la 0017", () => {
  test("no exporta las tablas retiradas", () => {
    const exportados = Object.keys(schema);
    for (const nombre of [
      "studentPortalScore",
      "sectionRepresentativeClaim",
      "studentRecordEntry",
      "studentAcademicSnapshot",
      "studentPeriodSummary",
      "courseEquivalence",
      "appSetting",
    ]) {
      expect(exportados).not.toContain(nombre);
    }
  });

  test("enrollment conserva las horas y pierde las columnas del portal", () => {
    const columnas = Object.keys(getTableColumns(schema.enrollment));
    expect(columnas).toEqual(expect.arrayContaining(["attendedHours", "absentHours", "totalHours"]));
    for (const columna of ["finalGrade", "portalGradesReadAt", "portalAttendanceReadAt"]) {
      expect(columnas).not.toContain(columna);
    }
  });

  test("course_offering conserva total_hours y course pierde weekly_hours", () => {
    expect(Object.keys(getTableColumns(schema.courseOffering))).toContain("totalHours");
    expect(Object.keys(getTableColumns(schema.course))).not.toContain("weeklyHours");
  });

  test("se conservan las tablas que leen funciones que se quedan", () => {
    const exportados = Object.keys(schema);
    for (const nombre of ["studentCourseProgress", "sectionRepresentative", "syllabus", "student"]) {
      expect(exportados).toContain(nombre);
    }
  });
});
