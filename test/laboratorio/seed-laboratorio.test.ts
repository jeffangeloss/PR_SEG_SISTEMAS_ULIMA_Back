import { describe, expect, test } from "bun:test";
import catalogoJson from "../../src/db/seed/laboratorio.catalogo.json" with { type: "json" };
import { DATOS_LAB, type DatosLab } from "../../src/db/seed/laboratorio.datos.js";
import {
  finDelPeriodo, fnv1a, horasDeAsistencia, notaDeterminista, planificar, progresoDeMalla,
  semanasDelPeriodo, semanasTranscurridas, validarDatos, type CatalogoLab,
} from "../../src/db/seed/laboratorio.logic.js";
import { AttendanceRiskService } from "../../src/modules/attendance-risk/attendance-risk.service.js";
import type { AttendanceRiskRepository } from "../../src/modules/attendance-risk/attendance-risk.repository.js";
import type { AttendanceRiskRawRow } from "../../src/modules/attendance-risk/attendance-risk.types.js";
import type { EventBus } from "../../src/events/index.js";
import { CONTENT_BY_VERSION, CURRENT_VERSION } from "../../src/modules/specialty-test/content/index.js";
import { resolveSpecialtyIds } from "../../src/modules/specialty-test/specialty-test.view.js";

/**
 * Seed de la base de laboratorio: solo la lógica pura y los datos, sin base de datos.
 * Que el seed escriba de verdad lo prueba scripts/laboratorio/levantar-bd.sh contra el
 * Postgres local del laboratorio.
 */
const catalogo = catalogoJson as unknown as CatalogoLab;
const HOY = "2026-10-04";
const plan = planificar(DATOS_LAB, catalogo, HOY);

/** Una copia de los datos que se puede romper sin tocar la original. */
const copia = (): DatosLab => structuredClone(DATOS_LAB) as DatosLab;

describe("datos sintéticos del laboratorio", () => {
  test("validarDatos no encuentra problemas", () => {
    expect(validarDatos(DATOS_LAB, catalogo)).toEqual([]);
  });

  test("los códigos de alumno son 2099xxxx y ninguno tiene forma de código real", () => {
    for (const a of DATOS_LAB.alumnos) {
      expect(a.codigo).toMatch(/^2099\d{4}$/);
      expect(a.codigo).not.toMatch(/^20(1|2)\d{6}$/);
    }
  });

  test("todos los correos son @laboratorio.test y las cuentas docentes son lab.*", () => {
    for (const a of plan.alumnos) expect(a.correo).toBe(`${a.codigo}@laboratorio.test`);
    for (const d of DATOS_LAB.docentes) {
      expect(d.correo.endsWith("@laboratorio.test")).toBe(true);
      if (d.cuenta !== null) expect(d.cuenta).toMatch(/^lab\./);
    }
    expect(JSON.stringify(DATOS_LAB).toLowerCase()).not.toContain("ulima");
  });

  test("el archivo de datos no lleva contraseñas", async () => {
    const texto = await Bun.file("src/db/seed/laboratorio.datos.ts").text();
    expect(texto).not.toContain("Lab.2026");
    expect(texto).not.toMatch(/password\s*[:=]/i);
  });

  test("el catálogo no trae personas", () => {
    const texto = JSON.stringify(catalogoJson).toLowerCase();
    expect(texto).not.toContain("@");
    expect(Object.keys(catalogoJson).sort()).toEqual([
      "_origen", "assessment_type", "career", "course", "course_prerequisite", "curriculum",
      "curriculum_course", "curriculum_course_specialty", "specialty",
    ]);
  });

  test("las cuatro especialidades del test vigente existen y están activas", () => {
    const activas = catalogo.specialty.filter((s) => s.is_active).map(({ id, name }) => ({ id, name }));
    expect(resolveSpecialtyIds(CONTENT_BY_VERSION.get(CURRENT_VERSION)!, activas)).not.toBeNull();
  });
});

describe("validarDatos detecta lo que rompería la base o la coherencia", () => {
  test("un código de alumno real", () => {
    const d = copia();
    d.alumnos[0].codigo = "20231234";
    expect(validarDatos(d, catalogo).some((p) => p.includes("2099xxxx"))).toBe(true);
  });

  test("un choque de horario", () => {
    const d = copia();
    d.secciones[1].sesiones[0] = { ...d.secciones[0].sesiones[0] };
    expect(validarDatos(d, catalogo).some((p) => p.includes("choque de horario"))).toBe(true);
  });

  test("pesos que no suman 100", () => {
    const d = copia();
    d.evaluaciones[0].peso = 25;
    expect(validarDatos(d, catalogo).some((p) => p.includes("suman 105"))).toBe(true);
  });

  test("un curso sin su requisito aprobado", () => {
    const d = copia();
    // Ciberseguridad (650065) pide Redes de Computadoras, que un alumno de ciclo 6 está llevando.
    d.alumnos[0].secciones = [...d.alumnos[0].secciones, "LAB-6"];
    expect(validarDatos(d, catalogo).some((p) => p.includes("no cumple un requisito"))).toBe(true);
  });

  test("un delegado que no está matriculado en su sección", () => {
    const d = copia();
    d.alumnos[0].secciones = ["LAB-2", "LAB-3", "LAB-4"];
    expect(validarDatos(d, catalogo).some((p) => p.includes("sin estar matriculado"))).toBe(true);
  });

  test("un correo institucional real", () => {
    const d = copia();
    d.docentes[2].correo = "alguien@ulima.edu.pe";
    const problemas = validarDatos(d, catalogo);
    expect(problemas.some((p) => p.includes("ulima"))).toBe(true);
    expect(problemas.some((p) => p.includes("@laboratorio.test"))).toBe(true);
  });
});

describe("fechas del período", () => {
  test("16 semanas de lunes a domingo, la última termina el día de fin", () => {
    const semanas = semanasDelPeriodo("2026-08-24", 16);
    expect(semanas).toHaveLength(16);
    expect(semanas[0]).toEqual({ numero: 1, inicio: "2026-08-24", fin: "2026-08-30" });
    expect(semanas[15].fin).toBe(finDelPeriodo("2026-08-24", 16));
    expect(finDelPeriodo("2026-08-24", 16)).toBe("2026-12-13");
  });

  test("semanasTranscurridas cuenta la semana en curso y respeta el mínimo y el máximo", () => {
    expect(semanasTranscurridas("2026-08-24", "2026-10-04", 16, 1)).toBe(6);
    expect(semanasTranscurridas("2026-08-24", "2026-10-05", 16, 1)).toBe(7);
    expect(semanasTranscurridas("2026-08-24", "2026-08-25", 16, 6)).toBe(6);
    expect(semanasTranscurridas("2026-08-24", "2027-03-01", 16, 6)).toBe(16);
  });
});

describe("horas de asistencia", () => {
  test("cumplen los CHECK de enrollment en todas las matrículas", () => {
    for (const a of plan.alumnos) {
      for (const m of a.matriculas) {
        expect(m.asistidas).toBeGreaterThanOrEqual(0);
        expect(m.inasistencias).toBeGreaterThanOrEqual(0);
        expect(m.total).toBeGreaterThan(0);
        expect(m.asistidas + m.inasistencias).toBeLessThanOrEqual(m.total);
      }
    }
  });

  test("asistidas + inasistencias son las horas transcurridas de la sección", () => {
    for (const a of plan.alumnos) {
      for (const m of a.matriculas) {
        const s = plan.secciones.find((x) => x.codigo === m.seccion)!;
        expect(m.asistidas + m.inasistencias).toBe(s.horasTranscurridas);
        expect(m.total).toBe(s.totalHoras);
      }
    }
  });

  test("course_offering.total_hours son las horas semanales por las 16 semanas", () => {
    for (const s of plan.secciones) expect(s.totalHoras).toBe(4 * 16);
  });

  test("nunca pasan de las horas transcurridas, aunque el perfil pida más", () => {
    const h = horasDeAsistencia({ codigo: "20990006", seccion: "LAB-1", perfil: "impedido", ciclo: 6, total: 64, transcurridas: 8, horasSesion: 2 });
    expect(h).toEqual({ asistidas: 0, inasistencias: 8, total: 64 });
  });

  test("el servicio real de /attendance-risk ve un alumno en riesgo y uno impedido en LAB-1", async () => {
    const lab1 = plan.secciones.find((s) => s.codigo === "LAB-1")!;
    const filas: AttendanceRiskRawRow[] = plan.alumnos.flatMap((a) =>
      a.matriculas
        .filter((m) => m.seccion === "LAB-1")
        .map((m) => ({
          code: a.codigo,
          full_name: a.nombre,
          current_level: a.nivel,
          absent_hours: String(m.inasistencias),
          total_section_hours: String(m.total),
          enrollment_total_hours: String(m.total),
          cycle: lab1.ciclo,
        })),
    );
    const servicio = new AttendanceRiskService(
      {
        findStudentsBySectionId: async () => filas,
        findModalSessionHours: async () => lab1.horasSesion,
      } as unknown as AttendanceRiskRepository,
      {} as unknown as EventBus,
    );
    const { students, summary } = await servicio.getAttendanceRisk(1);
    expect(summary.en_riesgo).toBeGreaterThanOrEqual(1);
    expect(summary.impedido).toBeGreaterThanOrEqual(1);
    expect(summary.sin_datos).toBe(0);
    expect(students.find((s) => s.code === "20990005")?.status).toBe("en_riesgo");
    expect(students.find((s) => s.code === "20990006")?.status).toBe("impedido");
  });
});

describe("notas y avance de malla", () => {
  test("notaDeterminista es estable y queda entre 0 y 20", () => {
    expect(notaDeterminista("20990001", "LAB-1", "PC1", "normal")).toBe(notaDeterminista("20990001", "LAB-1", "PC1", "normal"));
    for (const a of plan.alumnos) {
      for (const n of a.notas) {
        expect(n.valor).toBeGreaterThanOrEqual(0);
        expect(n.valor).toBeLessThanOrEqual(20);
      }
    }
  });

  test("el alumno con la asistencia comprometida también desaprueba esa práctica", () => {
    const enRiesgo = plan.alumnos.find((a) => a.codigo === "20990005")!;
    expect(enRiesgo.notas.find((n) => n.seccion === "LAB-1")!.valor).toBeLessThan(10);
  });

  test("solo se publican las evaluaciones marcadas como publicadas", () => {
    const publicadas = DATOS_LAB.evaluaciones.filter((e) => e.publicada).map((e) => e.codigo);
    for (const a of plan.alumnos) {
      expect(a.notas).toHaveLength(a.matriculas.length * publicadas.length);
    }
  });

  test("fnv1a no depende de nada más que del texto", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
  });

  test("progresoDeMalla: lo inscrito en curso, obligatorios anteriores aprobados, electivos no", () => {
    const malla = [
      { id: 1, curriculum_id: 1, course_id: 1, cycle: 1, display_order: 1, credit: 3, category: "general_studies" },
      { id: 2, curriculum_id: 1, course_id: 2, cycle: 2, display_order: 1, credit: 3, category: "faculty" },
      { id: 3, curriculum_id: 1, course_id: 3, cycle: 2, display_order: 2, credit: 3, category: "elective" },
      { id: 4, curriculum_id: 1, course_id: 4, cycle: 3, display_order: 1, credit: 3, category: "faculty" },
    ];
    expect(progresoDeMalla(3, malla, new Set([4]), new Set([2]))).toEqual([
      { curriculumCourseId: 1, estado: "approved" },
      { curriculumCourseId: 2, estado: "failed" },
      { curriculumCourseId: 4, estado: "in_progress" },
    ]);
  });

  test("cada alumno matriculado tiene en curso exactamente lo que lleva", () => {
    for (const a of plan.alumnos) {
      const enCurso = a.progreso.filter((p) => p.estado === "in_progress").map((p) => p.curriculumCourseId).sort();
      const lleva = a.matriculas.map((m) => plan.secciones.find((s) => s.codigo === m.seccion)!.curriculumCourseId).sort();
      expect(enCurso).toEqual(lleva);
    }
  });

  test("el alumno sin matrícula existe para probar el 403 NOT_ENROLLED", () => {
    expect(plan.alumnos.filter((a) => a.matriculas.length === 0).map((a) => a.codigo)).toEqual(["20990012"]);
  });
});
