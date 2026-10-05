import { describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import { EventBus } from "../../src/events/index.js";
import type { ScheduleRepository } from "../../src/modules/schedule/schedule.repository.js";

/**
 * Contrato HTTP de la variante de laboratorio, que retira la integración con el
 * portal de la Universidad de Lima (LABORATORIO.md).
 *
 * Las rutas retiradas dejan de montarse, así que responden el 404 de Hono. La
 * asistencia se conserva: /attendance-risk sigue montado y las secciones siguen
 * trayendo sus horas, sin la hora de lectura del portal.
 *
 * El montaje se lee de src/modules/index.ts como texto y no importándolo, porque
 * cada `index.ts` de módulo construye su repositorio con `db` al cargarse y
 * dejaría ese doble fijo para los demás archivos de prueba. Por la misma razón
 * solo se importan las fábricas de rutas y el servicio del horario. Nada de esto
 * toca la base: el mock de `db` va antes de cargarlas, como en el resto de la
 * suite, porque el módulo real abre un cliente de Postgres al evaluarse.
 */
mock.module("../../src/db/index.js", () => ({ db: { execute: async () => [] } }));

const { createAuthRoutes } = await import("../../src/modules/auth/auth.routes.js");
const { createGradesRoutes } = await import("../../src/modules/grades/grades.routes.js");
const { ScheduleService } = await import("../../src/modules/schedule/schedule.service.js");

/** Prefijos que `registerModules` monta con `app.route`. */
const montados = async (): Promise<string[]> => {
  const texto = await Bun.file("src/modules/index.ts").text();
  return [...texto.matchAll(/app\.route\("([^"]+)"/g)].map((m) => m[1]);
};

/** Rutas de un `Hono` tal como quedaron registradas, como "MÉTODO ruta". */
const rutas = (hono: Hono) => hono.routes.map((r) => `${r.method} ${r.path}`);

describe("rutas retiradas: ya no se montan", () => {
  test("registerModules no monta /portal-sync, /academic-record ni /config", async () => {
    const prefijos = await montados();
    expect(prefijos.length).toBeGreaterThan(10);
    for (const retirado of ["/portal-sync", "/academic-record", "/config"]) {
      expect(prefijos).not.toContain(retirado);
    }
  });

  test("GET /grades/me/ulima ya no está registrada en /grades", () => {
    const registradas = rutas(createGradesRoutes({} as never));
    expect(registradas.some((r) => r.endsWith("/me/ulima"))).toBe(false);
    expect(registradas).toContain("GET /me/courses");
  });

  test("POST /auth/register ya no está registrada en /auth", () => {
    const registradas = rutas(createAuthRoutes({} as never));
    expect(registradas.some((r) => r.endsWith("/register"))).toBe(false);
    expect(registradas).toContain("POST /login");
  });

  test("una ruta que no se monta responde el 404 de Hono", async () => {
    const app = new Hono();
    app.route("/auth", createAuthRoutes({} as never));
    expect((await app.request("/auth/register", { method: "POST", body: "{}" })).status).toBe(404);
  });
});

describe("lo que se conserva", () => {
  test("registerModules sigue montando /attendance-risk, /schedule y /course-detail", async () => {
    const prefijos = await montados();
    for (const conservado of ["/attendance-risk", "/schedule", "/course-detail", "/grades", "/auth"]) {
      expect(prefijos).toContain(conservado);
    }
  });

  test("GET / no lista /portal-sync", async () => {
    // Se lee el archivo en vez de importar src/server.ts, igual que
    // test/HU35_jeff/time-blocks.routes.test.ts.
    const texto = await Bun.file("src/server.ts").text();
    expect(texto).not.toContain('"/portal-sync"');
    expect(texto).toContain('"/advising"');
  });
});

describe("secciones del horario: conservan la asistencia y pierden la hora de lectura del portal", () => {
  const fila = {
    section_id: 7,
    section_code: "801",
    teacher_code: "T001",
    course_id: 3,
    course_name: "CURSO FICTICIO",
    attended_hours: "10",
    absent_hours: "2",
    total_hours: "64",
    session_id: 1,
    day_of_week: 1,
    start_time: "08:00:00",
    end_time: "10:00:00",
    classroom: "A-101",
    color_hex: null,
  };

  const servicio = () =>
    new ScheduleService(
      {
        findActiveEnrollmentsWithSessions: async () => [fila],
        findAcademicWeeksForActivePeriod: async () => [],
        findActivePeriodDates: async () => null,
      } as unknown as ScheduleRepository,
      new EventBus(),
    );

  test("cada sección trae asistido, inasistencia, total, asistenciaDisponible y horasTranscurridas", async () => {
    const { secciones } = await servicio().getSessions(42);
    expect(secciones).toHaveLength(1);
    expect(secciones[0]).toMatchObject({
      asistido: 10,
      inasistencia: 2,
      total: 64,
      asistenciaDisponible: true,
      horasTranscurridas: 12,
    });
  });

  test("ninguna sección trae asistenciaLeidaEn", async () => {
    const { secciones } = await servicio().getSessions(42);
    expect("asistenciaLeidaEn" in secciones[0]).toBe(false);
  });
});
