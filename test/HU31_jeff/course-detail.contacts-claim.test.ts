import { describe, expect, mock, test, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import jwt from "jsonwebtoken";

/**
 * RS-19: guarda de pertenencia de
 * `GET /course-detail/sections/:sectionId/contacts`, y ausencia de los
 * delegados pendientes del portal, que la variante de laboratorio retira.
 *
 * El handler NO pasa por un service: arma SQL crudo y lo manda con
 * `db.execute` (la propia RS-20 lo dice: `CourseDetailService.getContacts`
 * existe pero ninguna ruta lo registra, así que el punto de extensión es la
 * ruta). Por eso hay que doblar `db`.
 *
 * El doble NO devuelve filas enlatadas: ejecuta el SQL de verdad contra SQLite
 * en memoria. La guarda de pertenencia se resuelve DENTRO de la consulta, y un
 * doble que devolviera las filas ya filtradas estaría probando mi
 * reimplementación de la regla, no la regla. Las consultas del handler son
 * ANSI (join, left join, exists, order by, limit) y no usan nada exclusivo de
 * Postgres, así que se pueden evaluar tal cual.
 *
 * SQLite en memoria no es "una base real" en el sentido de la consigna: no hay
 * Postgres, ni Neon, ni red, ni estado entre pruebas. Es un doble que sabe
 * ejecutar SQL, y sin eso la guarda no es verificable.
 */

const dialect = new PgDialect();
let bd = new Database(":memory:");

/** `db` de mentira. Traduce lo que Drizzle emite ($1, $2…) a los marcadores
 *  posicionales de SQLite, respetando el orden en que aparecen (un mismo $n
 *  repetido se liga las veces que haga falta). */
const fakeDb = {
  execute: async (query: SQL) => {
    const { sql: texto, params } = dialect.sqlToQuery(query);
    const ligados: unknown[] = [];
    const traducido = texto.replace(/\$(\d+)/g, (_todo, n: string) => {
      ligados.push(params[Number(n) - 1]);
      return "?";
    });
    return bd.query(traducido).all(...(ligados as never[]));
  },
};

// El mock tiene que quedar instalado ANTES de que se cargue la ruta: tanto el
// handler como `authMiddleware` importan este mismo módulo, y el módulo real
// abre un cliente de Postgres al evaluarse. Por eso las importaciones de abajo
// son dinámicas: los `import` estáticos se izan por encima de esta línea.
mock.module("../../src/db/index.js", () => ({ db: fakeDb }));

const { createCourseDetailRoutes } = await import(
  "../../src/modules/course-detail/course-detail.routes.js"
);
const { errorHandler } = await import("../../src/shared/middleware/error-handler.js");
const { config } = await import("../../src/config/app-config.js");

// Se monta como en `server.ts`: el handler lanza `HttpError` y quien lo
// traduce a 403 con `code` es el errorHandler global. Sin él, el 403 de
// SECTION_FORBIDDEN saldría como 500 y la prueba mediría otra cosa.
const app = new Hono();
app.onError(errorHandler);
// El controller es un doble mínimo: la guarda de pertenencia corre ANTES que
// él, así que para el caso 403 nunca se lo llama; para el caso permitido basta
// con que responda algo y así se distingue "pasó la guarda" de "reventó".
const controllerDoble = {
  getAnnouncements: (c: { json: (v: unknown) => unknown }) => c.json({ anuncios: [] }),
} as never;
app.route("/course-detail", createCourseDetailRoutes(controllerDoble));

const DDL = `
  create table app_user (id integer primary key, code text, full_name text,
    institutional_email text, token_version integer, networking_opt_in integer,
    avatar_public_id text, avatar_version text);
  create table user_social_link (id integer primary key, user_id integer,
    platform text, url text, label text);
  create table student (id integer primary key, user_id integer, career_id integer);
  create table teacher (id integer primary key, teacher_code text, full_name text, user_id integer);
  create table section (id integer primary key, course_offering_id integer,
    teacher_id integer, code text, jp_id integer);
  create table enrollment (id integer primary key, student_id integer, section_id integer);
  create table section_representative (id integer primary key, section_id integer,
    enrollment_id integer, position text, is_active integer);
`;

/** Identificadores del mundo de prueba. Códigos y nombres ficticios (RS-23). */
const SEC_A = 10; // sección propia: titular T_TITULAR, JP T_JP
const SEC_B = 20; // sección ajena: titular T_AJENO
const T_TITULAR = 1, T_JP = 2, T_AJENO = 3;
const U_ANA = 100, U_BRUNO = 101, U_CARLA = 102;
const E_ANA = 1000, E_BRUNO = 1001;
const COD_BRUNO = "20200002";

/** Mundo mínimo pero completo: dos secciones, dos alumnos en la propia y uno
 *  en la ajena, tres docentes. Cada prueba agrega encima lo que necesita. */
const sembrar = () => {
  bd = new Database(":memory:");
  bd.run(DDL);

  const usuario = (id: number, code: string, nombre: string) =>
    bd.run(
      `insert into app_user (id, code, full_name, institutional_email, token_version, networking_opt_in)
       values (?, ?, ?, ?, 1, 0)`,
      [id, code, nombre, `u${id}@aloe.ulima.edu.pe`],
    );

  usuario(U_ANA, "20200001", "CASTRO VEGA ANA LUCIA");
  usuario(U_BRUNO, COD_BRUNO, "QUISPE ROJAS BRUNO");
  usuario(U_CARLA, "20200003", "SALAZAR PINTO CARLA");
  usuario(200, "D001", "GARCIA LOPEZ ROSA MARIA");
  usuario(201, "D002", "TORRES DIAZ LUIS ALBERTO");
  usuario(202, "D003", "MENDOZA SOLIS ELENA");

  for (const [id, user] of [[U_ANA, U_ANA], [U_BRUNO, U_BRUNO], [U_CARLA, U_CARLA]] as const) {
    bd.run(`insert into student (id, user_id, career_id) values (?, ?, 5)`, [id, user]);
  }

  bd.run(`insert into teacher (id, teacher_code, full_name, user_id) values (?,?,?,?)`,
    [T_TITULAR, "T001", "GARCIA LOPEZ ROSA MARIA", 200]);
  bd.run(`insert into teacher (id, teacher_code, full_name, user_id) values (?,?,?,?)`,
    [T_JP, "T002", "TORRES DIAZ LUIS ALBERTO", 201]);
  bd.run(`insert into teacher (id, teacher_code, full_name, user_id) values (?,?,?,?)`,
    [T_AJENO, "T003", "MENDOZA SOLIS ELENA", 202]);

  bd.run(`insert into section (id, course_offering_id, teacher_id, code, jp_id) values (?,1,?,?,?)`,
    [SEC_A, T_TITULAR, "952", T_JP]);
  bd.run(`insert into section (id, course_offering_id, teacher_id, code, jp_id) values (?,1,?,?,null)`,
    [SEC_B, T_AJENO, "958"]);

  bd.run(`insert into enrollment (id, student_id, section_id) values (?,?,?)`, [E_ANA, U_ANA, SEC_A]);
  bd.run(`insert into enrollment (id, student_id, section_id) values (?,?,?)`, [E_BRUNO, U_BRUNO, SEC_A]);
  bd.run(`insert into enrollment (id, student_id, section_id) values (1002,?,?)`, [U_CARLA, SEC_B]);
};

const representanteReal = (sectionId: number, enrollmentId: number, position: string, activo = true) =>
  bd.run(
    `insert into section_representative (section_id, enrollment_id, position, is_active) values (?,?,?,?)`,
    [sectionId, enrollmentId, position, activo ? 1 : 0],
  );

const tokenAlumno = (userId: number, studentId: number, role = "student") =>
  jwt.sign({ sub: String(userId), studentId, role, tokenVersion: 1 }, config.auth.jwtSecret);

const tokenDocente = (userId: number, teacherId: number) =>
  jwt.sign({ sub: String(userId), teacherId, role: "teacher", tokenVersion: 1 }, config.auth.jwtSecret);

const contactos = (sectionId: number, token: string) =>
  app.request(`/course-detail/sections/${sectionId}/contacts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

type Cuerpo = {
  docente: unknown;
  jefePractica: unknown;
  alumnos: Array<{ user: { code: string }; roleInSection: string }>;
};

beforeEach(sembrar);

describe("RS-19: guarda de pertenencia", () => {
  test("el alumno matriculado en la sección sí puede leer sus contactos", async () => {
    // El caso feliz existe para que el 403 de abajo signifique algo: si la
    // guarda rechazara a todo el mundo, la prueba de acceso denegado pasaría
    // igual y no probaría nada.
    const res = await contactos(SEC_A, tokenAlumno(U_ANA, U_ANA));
    expect(res.status).toBe(200);
    const body = await res.json() as Cuerpo;
    expect(body.alumnos.map((a) => a.user.code).sort()).toEqual(["20200001", COD_BRUNO]);
  });

  test("un alumno de OTRA sección recibe 403 SECTION_FORBIDDEN", async () => {
    // El invariante que más importa de toda la feature. Antes de la guarda la
    // ruta solo exigía JWT + rol, sin ningún predicado sobre QUIÉN pregunta:
    // cualquiera podía iterar `sectionId` y leerse la nómina de cualquier
    // sección, con nombres, códigos y correos.
    const res = await contactos(SEC_A, tokenAlumno(U_CARLA, U_CARLA));
    expect(res.status).toBe(403);
    expect((await res.json() as { error: { code: string } }).error.code).toBe("SECTION_FORBIDDEN");
  });

  test("matricular a esa misma alumna la deja pasar: la guarda depende de eso y de nada más", async () => {
    // Contraprueba del test anterior. Un 403 puede salir por el motivo
    // equivocado (rol, ruta mal escrita, token inválido) y la prueba pasaría
    // igual. Acá cambia UN dato —la fila de `enrollment`— y con el mismo token
    // y la misma URL la respuesta pasa a 200: queda demostrado que lo que
    // decide es la matrícula.
    bd.run(`insert into enrollment (id, student_id, section_id) values (1005, ?, ?)`, [U_CARLA, SEC_A]);
    const res = await contactos(SEC_A, tokenAlumno(U_CARLA, U_CARLA));
    expect(res.status).toBe(200);
  });

  test("el 403 no filtra ni un solo dato de la sección ajena", async () => {
    // Rechazar con el cuerpo lleno sería igual de grave que responder 200: lo
    // que se protege es el dato, no el código de estado.
    const texto = await (await contactos(SEC_A, tokenAlumno(U_CARLA, U_CARLA))).text();
    expect(texto).not.toContain(COD_BRUNO);
    expect(texto).not.toContain("QUISPE");
    expect(texto).not.toContain("GARCIA");
    expect(texto).not.toContain("alumnos");
  });

  test("una sección que no existe también responde 403, no 404", async () => {
    // Distinguir "no existe" de "no perteneces" convertiría la guarda en un
    // oráculo de qué ids de sección están ocupados. Además el handler no
    // consulta la existencia por separado: la misma consulta resuelve ambas
    // cosas, así que iterar ids no dice nada.
    const res = await contactos(999, tokenAlumno(U_ANA, U_ANA));
    expect(res.status).toBe(403);
    expect((await res.json() as { error: { code: string } }).error.code).toBe("SECTION_FORBIDDEN");
  });

  test("el docente titular de la sección puede leerla", async () => {
    // Un token de docente no trae `studentId`: la guarda tiene que reconocerlo
    // por `section.teacher_id` y no caer en el centinela.
    const res = await contactos(SEC_A, tokenDocente(200, T_TITULAR));
    expect(res.status).toBe(200);
    // Y ve la sección entera.
    const body = await res.json() as Cuerpo;
    expect(body.alumnos).toHaveLength(2);
  });

  test("el jefe de práctica de la sección también puede leerla", async () => {
    // HU18: el JP cuelga de `section.jp_id`, una columna distinta del titular.
    // Sin esa rama, el JP quedaría fuera de la pestaña de contactos de su
    // propia sección.
    const res = await contactos(SEC_A, tokenDocente(201, T_JP));
    expect(res.status).toBe(200);
  });

  test("un docente de OTRA sección recibe 403 SECTION_FORBIDDEN", async () => {
    // Ser docente no es un pase libre: la pertenencia se evalúa contra ESTA
    // sección. `T_AJENO` es titular de SEC_B y no tiene nada que ver con SEC_A.
    const res = await contactos(SEC_A, tokenDocente(202, T_AJENO));
    expect(res.status).toBe(403);
    expect((await res.json() as { error: { code: string } }).error.code).toBe("SECTION_FORBIDDEN");
  });

  test("un alumno cuyo student.id coincide con el teacher.id del titular NO entra", async () => {
    // `student.id` y `teacher.id` son secuencias independientes: que existan un
    // alumno 1 y un docente 1 no es rebuscado, es lo normal. La guarda compara
    // `sec.teacher_id` contra `teacherId` (ausente en un token de alumno, de
    // ahí el centinela 0) y jamás contra `studentId`. Si las cruzara, el alumno
    // con el id del titular leería la sección sin estar matriculado.
    bd.run(`insert into app_user (id, code, full_name, institutional_email, token_version, networking_opt_in)
            values (103, '20200004', 'DIEGO RIOS PAREDES', 'u103@aloe.ulima.edu.pe', 1, 0)`);
    bd.run(`insert into student (id, user_id, career_id) values (?, 103, 5)`, [T_TITULAR]);
    bd.run(`insert into enrollment (id, student_id, section_id) values (1004, ?, ?)`, [T_TITULAR, SEC_B]);

    const res = await contactos(SEC_A, tokenAlumno(103, T_TITULAR));
    expect(res.status).toBe(403);
  });

  test("un docente cuyo teacher.id coincide con el student.id de un matriculado NO entra", async () => {
    // El cruce simétrico: `e.student_id` se compara contra `studentId`, ausente
    // en un token de docente. Ana está matriculada en SEC_A con student.id 100;
    // un docente ajeno con teacher.id 100 no puede heredar su matrícula.
    bd.run(`insert into teacher (id, teacher_code, full_name, user_id) values (?, 'T004', 'VARGAS LEON PEDRO', 202)`,
      [U_ANA]);
    const res = await contactos(SEC_A, tokenDocente(202, U_ANA));
    expect(res.status).toBe(403);
  });
});

describe("RS-19: el rol sale de section_representative y no hay delegados pendientes", () => {
  test("la respuesta no trae la clave representantesPendientes", async () => {
    // La variante de laboratorio retira los delegados pendientes que leía el
    // portal. La clave desaparece del contrato en vez de llegar vacía, y la
    // app ya la tolera ausente.
    const body = await (await contactos(SEC_A, tokenAlumno(U_ANA, U_ANA))).json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["alumnos", "docente", "jefePractica"]);
    expect("representantesPendientes" in body).toBe(false);
  });

  test("con section_representative activo el alumno sale con su cargo", async () => {
    representanteReal(SEC_A, E_ANA, "delegate");

    const body = await (await contactos(SEC_A, tokenAlumno(U_ANA, U_ANA))).json() as Cuerpo;
    expect(body.alumnos.find((a) => a.user.code === "20200001")?.roleInSection).toBe("delegado");
  });

  test("sin fila en section_representative nadie figura como delegado en alumnos[]", async () => {
    // RS-19: solo `section_representative` autoriza. Ni Ana ni Bruno tienen
    // fila de representante, así que su `roleInSection` es "estudiante".

    const body = await (await contactos(SEC_A, tokenAlumno(U_ANA, U_ANA))).json() as Cuerpo;
    expect(body.alumnos.map((a) => a.roleInSection)).toEqual(["estudiante", "estudiante"]);
  });

  test("un representante DESACTIVADO tampoco etiqueta: el rol rancio no otorga nada", async () => {
    // RS-18: al alumno desactivado se le deja el rol rancio en el token hasta
    // el próximo login porque no otorga nada, y `requireRepresentative`
    // revalida sección por sección. La pestaña de contactos tiene que contar la
    // misma historia: el join de `alumnos[]` filtra por `sr.is_active = true`,
    // así que un ex delegado vuelve a figurar como "estudiante".
    representanteReal(SEC_A, E_ANA, "delegate", false);

    const body = await (await contactos(SEC_A, tokenAlumno(U_ANA, U_ANA))).json() as Cuerpo;
    expect(body.alumnos.find((a) => a.user.code === "20200001")?.roleInSection).toBe("estudiante");
  });

  test("varios enlaces sociales no duplican al alumno en alumnos[]", async () => {
    // El `left join user_social_link` multiplica filas: un alumno con dos redes
    // vuelve dos veces del SQL. El agrupado por `enrollment_id` es lo que evita
    // que aparezca dos veces.
    bd.run(`insert into user_social_link (user_id, platform, url, label)
            values (?, 'linkedin', 'https://example.test/a', null)`, [U_ANA]);
    bd.run(`insert into user_social_link (user_id, platform, url, label)
            values (?, 'github', 'https://example.test/b', null)`, [U_ANA]);

    const body = await (await contactos(SEC_A, tokenAlumno(U_ANA, U_ANA))).json() as Cuerpo;
    expect(body.alumnos).toHaveLength(2);
    expect(body.alumnos.filter((a) => a.user.code === "20200001")).toHaveLength(1);
  });
});

describe("guarda de pertenencia en /announcements", () => {
  // Esta ruta devuelve los anuncios CON los datos del autor: nombre, código,
  // correo institucional y cargo. Hasta el 2026-09-04 solo exigía sesión
  // iniciada, sin mirar si quien pregunta es de la sección, así que iterando
  // `sectionId` se podía juntar el padrón de delegados de toda la universidad
  // con sus correos. Es la misma guarda de /contacts, extraída a un helper.
  const anuncios = (sectionId: number, token: string) =>
    app.request(`/course-detail/sections/${sectionId}/announcements`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  test("el alumno matriculado en la sección pasa", async () => {
    const res = await anuncios(SEC_A, tokenAlumno(U_ANA, U_ANA));
    expect(res.status).toBe(200);
  });

  test("el alumno de OTRA sección recibe 403 SECTION_FORBIDDEN", async () => {
    // El caso que motiva la guarda.
    const res = await anuncios(SEC_B, tokenAlumno(U_ANA, U_ANA));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code)
      .toBe("SECTION_FORBIDDEN");
  });

  test("una sección inexistente también se rechaza, no se filtra por error", async () => {
    const res = await anuncios(999999, tokenAlumno(U_ANA, U_ANA));
    expect(res.status).toBe(403);
  });
});
