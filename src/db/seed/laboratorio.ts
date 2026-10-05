// Seed de la base de LABORATORIO (variante sin portal, ver LABORATORIO.md).
//
// Carga el catálogo institucional de laboratorio.catalogo.json, sin personas, y las personas y
// datos 100 % sintéticos de laboratorio.datos.ts. Solo corre contra un Postgres local: lo levanta
// scripts/laboratorio/levantar-bd.sh, que llama a este archivo con --apply.
//
//   bun --env-file=.env.laboratorio run src/db/seed/laboratorio.ts            # DRY-RUN: imprime el plan
//   bun --env-file=.env.laboratorio run src/db/seed/laboratorio.ts --apply    # escribe, en UNA transacción
//
// Contraseñas (REQUERIDAS, sin valor por defecto en el código; las de ejemplo están en
// .env.laboratorio.example):
//   LAB_PASSWORD_ALUMNO=...    la de las doce cuentas de alumno
//   LAB_PASSWORD_DOCENTE=...   la de las dos cuentas docentes
//
// Es idempotente: cada fila se escribe contra su llave natural, así que una segunda corrida deja
// los mismos conteos. Las contraseñas solo se fijan al crear la cuenta; para cambiarlas, se
// reconstruye la base con `levantar-bd.sh --reset`.

import "dotenv/config";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import catalogoJson from "./laboratorio.catalogo.json" with { type: "json" };
import { DATOS_LAB } from "./laboratorio.datos.js";
import { planificar, validarDatos, type CatalogoLab, type PlanLab } from "./laboratorio.logic.js";

const APPLY = process.argv.includes("--apply");
// Mismo costo que auth.service.ts (BCRYPT_COST) y que los hashes existentes.
const BCRYPT_COST = 10;
// password-reset.logic.ts exige 8 caracteres como mínimo a cualquier contraseña nueva.
const MIN_PASSWORD = 8;
const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const catalogo = catalogoJson as unknown as CatalogoLab;

function fallar(mensaje: string): never {
  console.error(`❌ ${mensaje}`);
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL ?? fallar("Falta DATABASE_URL (usa --env-file=.env.laboratorio).");
let host: string;
try {
  host = new URL(DATABASE_URL).hostname;
} catch {
  fallar("DATABASE_URL no es una URL válida.");
}
if (!HOSTS_LOCALES.has(host)) fallar(`DATABASE_URL apunta a «${host}». Este seed solo corre contra un Postgres local.`);

const PASSWORD_ALUMNO = process.env.LAB_PASSWORD_ALUMNO ?? "";
const PASSWORD_DOCENTE = process.env.LAB_PASSWORD_DOCENTE ?? "";
if (PASSWORD_ALUMNO.length < MIN_PASSWORD || PASSWORD_DOCENTE.length < MIN_PASSWORD) {
  fallar(`LAB_PASSWORD_ALUMNO y LAB_PASSWORD_DOCENTE son obligatorias y de ${MIN_PASSWORD} caracteres o más.`);
}

const problemas = validarDatos(DATOS_LAB, catalogo);
if (problemas.length > 0) fallar(`Los datos sintéticos no son coherentes:\n  - ${problemas.join("\n  - ")}`);

// Fecha local, no UTC: en Lima, desde las 19:00 la fecha UTC ya es la del día siguiente.
const ahora = new Date();
const dosCifras = (n: number) => String(n).padStart(2, "0");
const hoy = `${ahora.getFullYear()}-${dosCifras(ahora.getMonth() + 1)}-${dosCifras(ahora.getDate())}`;
const plan = planificar(DATOS_LAB, catalogo, hoy);

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

type Tx = postgres.TransactionSql;
const uno = async <T>(filas: Promise<T[]> | postgres.PendingQuery<postgres.Row[]>) => (await filas)[0] as T;

/** Tablas del catálogo cuyas id vienen del JSON: al final, su identidad se mueve detrás del máximo. */
const TABLAS_CON_ID_FIJO = [
  "career", "curriculum", "course", "curriculum_course", "course_prerequisite", "specialty", "assessment_type",
];

async function sembrarCatalogo(tx: Tx) {
  for (const r of catalogo.career) {
    await tx`insert into career (id, code, name, faculty) values (${r.id}, ${r.code}, ${r.name}, ${r.faculty})
      on conflict (id) do update set code = excluded.code, name = excluded.name, faculty = excluded.faculty`;
  }
  for (const r of catalogo.curriculum) {
    await tx`insert into curriculum (id, career_id, name) values (${r.id}, ${r.career_id}, ${r.name})
      on conflict (id) do update set career_id = excluded.career_id, name = excluded.name`;
  }
  for (const r of catalogo.course) {
    await tx`insert into course (id, code, name, default_credit, origin_faculty)
      values (${r.id}, ${r.code}, ${r.name}, ${r.default_credit}, ${r.origin_faculty})
      on conflict (id) do update set code = excluded.code, name = excluded.name,
        default_credit = excluded.default_credit, origin_faculty = excluded.origin_faculty`;
  }
  for (const r of catalogo.curriculum_course) {
    await tx`insert into curriculum_course (id, curriculum_id, course_id, cycle, display_order, credit, category)
      values (${r.id}, ${r.curriculum_id}, ${r.course_id}, ${r.cycle}, ${r.display_order}, ${r.credit}, ${r.category})
      on conflict (id) do update set cycle = excluded.cycle, display_order = excluded.display_order,
        credit = excluded.credit, category = excluded.category`;
  }
  for (const r of catalogo.course_prerequisite) {
    await tx`insert into course_prerequisite
        (id, curriculum_id, curriculum_course_id, prerequisite_type, prerequisite_curriculum_course_id, required_cycle)
      values (${r.id}, ${r.curriculum_id}, ${r.curriculum_course_id}, ${r.prerequisite_type},
        ${r.prerequisite_curriculum_course_id}, ${r.required_cycle})
      on conflict (id) do nothing`;
  }
  for (const r of catalogo.specialty) {
    await tx`insert into specialty (id, career_id, name, description, is_active)
      values (${r.id}, ${r.career_id}, ${r.name}, ${r.description}, ${r.is_active})
      on conflict (id) do update set name = excluded.name, description = excluded.description, is_active = excluded.is_active`;
  }
  for (const r of catalogo.curriculum_course_specialty) {
    await tx`insert into curriculum_course_specialty (curriculum_course_id, specialty_id)
      values (${r.curriculum_course_id}, ${r.specialty_id}) on conflict do nothing`;
  }
  for (const r of catalogo.assessment_type) {
    await tx`insert into assessment_type (id, name, abbreviation, description)
      values (${r.id}, ${r.name}, ${r.abbreviation}, ${r.description})
      on conflict (id) do update set name = excluded.name, abbreviation = excluded.abbreviation, description = excluded.description`;
  }
  for (const tabla of TABLAS_CON_ID_FIJO) {
    await tx`select setval(pg_get_serial_sequence(${`public.${tabla}`}, 'id'),
      greatest((select max(id) from ${tx(tabla)}), 1))`;
  }
}

async function sembrarSinteticos(tx: Tx, p: PlanLab, hashAlumno: string, hashDocente: string) {
  const career = catalogo.career[0];
  const curriculum = catalogo.curriculum[0];

  // Período: uq_academic_period_single_active admite uno solo activo.
  await tx`update academic_period set is_active = false where is_active and code <> ${p.periodo.codigo}`;
  const periodo = await uno<{ id: number }>(tx`
    insert into academic_period (code, start_date, end_date, is_active)
    values (${p.periodo.codigo}, ${p.periodo.inicio}, ${p.periodo.fin}, true)
    on conflict (code) do update set start_date = excluded.start_date, end_date = excluded.end_date, is_active = true
    returning id`);
  for (const s of p.semanas) {
    await tx`insert into academic_week (academic_period_id, week_number, start_date, end_date)
      values (${periodo.id}, ${s.numero}, ${s.inicio}, ${s.fin})
      on conflict (academic_period_id, week_number) do update set start_date = excluded.start_date, end_date = excluded.end_date`;
  }

  // Docentes: con cuenta, primero su app_user.
  const docenteId = new Map<string, number>();
  for (const d of p.docentes) {
    let userId: number | null = null;
    if (d.cuenta !== null) {
      userId = (await uno<{ id: number }>(tx`
        insert into app_user (code, full_name, institutional_email, password_hash)
        values (${d.cuenta}, ${d.nombre}, ${d.correo}, ${hashDocente})
        on conflict (code) do update set full_name = excluded.full_name, institutional_email = excluded.institutional_email
        returning id`)).id;
    }
    const t = await uno<{ id: number }>(tx`
      insert into teacher (teacher_code, full_name, institutional_email, user_id)
      values (${d.codigoDocente}, ${d.nombre}, ${d.correo}, ${userId})
      on conflict (teacher_code) do update set full_name = excluded.full_name,
        institutional_email = excluded.institutional_email, user_id = excluded.user_id
      returning id`);
    docenteId.set(d.clave, t.id);
  }

  // Ofertas, sílabos, evaluaciones, secciones y horario.
  const seccionId = new Map<string, number>();
  const ofertaId = new Map<string, number>();
  const evaluacionId = new Map<string, number>();
  for (const s of p.secciones) {
    const oferta = await uno<{ id: number }>(tx`
      insert into course_offering (academic_period_id, course_id, total_hours)
      values (${periodo.id}, ${s.cursoId}, ${s.totalHoras})
      on conflict (academic_period_id, course_id) do update set total_hours = excluded.total_hours
      returning id`);
    ofertaId.set(s.codigo, oferta.id);
    const silabo = await uno<{ id: number }>(tx`
      insert into syllabus (course_offering_id, title, drive_file_id, drive_file_url)
      values (${oferta.id}, ${s.silabo.titulo}, ${s.silabo.driveFileId}, ${s.silabo.driveFileUrl})
      on conflict (course_offering_id) do update set title = excluded.title,
        drive_file_id = excluded.drive_file_id, drive_file_url = excluded.drive_file_url
      returning id`);
    for (const e of p.evaluaciones) {
      const ev = await uno<{ id: number }>(tx`
        insert into assessment (syllabus_id, assessment_type_id, code, name, week_number, weight)
        values (${silabo.id}, ${e.tipoId}, ${e.codigo}, ${e.nombre}, ${e.semana}, ${e.peso})
        on conflict (syllabus_id, code) do update set assessment_type_id = excluded.assessment_type_id,
          name = excluded.name, week_number = excluded.week_number, weight = excluded.weight
        returning id`);
      evaluacionId.set(`${s.codigo}|${e.codigo}`, ev.id);
    }
    const sec = await uno<{ id: number }>(tx`
      insert into section (course_offering_id, teacher_id, code, jp_id)
      values (${oferta.id}, ${docenteId.get(s.docente)!}, ${s.codigo}, ${s.jp === null ? null : docenteId.get(s.jp)!})
      on conflict (course_offering_id, code) do update set teacher_id = excluded.teacher_id, jp_id = excluded.jp_id
      returning id`);
    seccionId.set(s.codigo, sec.id);
    for (const ses of s.sesiones) {
      await tx`insert into schedule_session (section_id, day_of_week, start_time, end_time, classroom, color_hex)
        values (${sec.id}, ${ses.dia}, ${ses.inicio}, ${ses.fin}, ${ses.aula}, ${s.color})
        on conflict (section_id, day_of_week, start_time) do update set end_time = excluded.end_time,
          classroom = excluded.classroom, color_hex = excluded.color_hex`;
    }
  }

  // Alumnos, matrículas con horas de asistencia, notas publicadas y avance de malla.
  const alumnoId = new Map<string, number>();
  const matriculaId = new Map<string, number>();
  for (const a of p.alumnos) {
    const user = await uno<{ id: number }>(tx`
      insert into app_user (code, full_name, institutional_email, password_hash, networking_opt_in)
      values (${a.codigo}, ${a.nombre}, ${a.correo}, ${hashAlumno}, ${a.networking})
      on conflict (code) do update set full_name = excluded.full_name,
        institutional_email = excluded.institutional_email, networking_opt_in = excluded.networking_opt_in
      returning id`);
    const st = await uno<{ id: number }>(tx`
      insert into student (user_id, career_id, curriculum_id, current_level, specialty_setup_completed)
      values (${user.id}, ${career.id}, ${curriculum.id}, ${a.nivel}, ${a.setupCompleto})
      on conflict (user_id) do update set career_id = excluded.career_id, curriculum_id = excluded.curriculum_id,
        current_level = excluded.current_level, specialty_setup_completed = excluded.specialty_setup_completed
      returning id`);
    alumnoId.set(a.codigo, st.id);

    if (a.especialidadId !== null) {
      await tx`insert into student_specialty (student_id, specialty_id, selection_type, is_active)
        values (${st.id}, ${a.especialidadId}, 'primary', true)
        on conflict (student_id, specialty_id) do update set selection_type = 'primary', is_active = true`;
    }
    if (a.networking) {
      await tx`insert into user_social_link (user_id, platform, url, label)
        values (${user.id}, 'website', ${`https://laboratorio.test/perfil/${a.codigo}`}, 'Perfil de laboratorio')
        on conflict (user_id, platform) do update set url = excluded.url, label = excluded.label`;
    }
    for (const m of a.matriculas) {
      const e = await uno<{ id: number }>(tx`
        insert into enrollment (student_id, section_id, status, attended_hours, absent_hours, total_hours)
        values (${st.id}, ${seccionId.get(m.seccion)!}, 'active', ${m.asistidas}, ${m.inasistencias}, ${m.total})
        on conflict (student_id, section_id) do update set status = 'active', attended_hours = excluded.attended_hours,
          absent_hours = excluded.absent_hours, total_hours = excluded.total_hours
        returning id`);
      matriculaId.set(`${a.codigo}|${m.seccion}`, e.id);
    }
    for (const n of a.notas) {
      await tx`insert into student_score (enrollment_id, assessment_id, value)
        values (${matriculaId.get(`${a.codigo}|${n.seccion}`)!}, ${evaluacionId.get(`${n.seccion}|${n.evaluacion}`)!}, ${n.valor})
        on conflict (enrollment_id, assessment_id) do update set value = excluded.value`;
    }
    for (const pr of a.progreso) {
      await tx`insert into student_course_progress (student_id, curriculum_id, curriculum_course_id, status)
        values (${st.id}, ${curriculum.id}, ${pr.curriculumCourseId}, ${pr.estado})
        on conflict (student_id, curriculum_course_id) do update set status = excluded.status`;
    }
  }

  // Delegado y subdelegado, y el aviso del delegado.
  const representanteId = new Map<string, number>();
  for (const r of p.representantes) {
    const fila = await uno<{ id: number }>(tx`
      insert into section_representative (section_id, enrollment_id, position, is_active)
      values (${seccionId.get(r.seccion)!}, ${matriculaId.get(`${r.alumno}|${r.seccion}`)!}, ${r.cargo}, true)
      on conflict (enrollment_id) do update set position = excluded.position, is_active = true
      returning id`);
    representanteId.set(`${r.alumno}|${r.seccion}`, fila.id);
  }
  const autor = representanteId.get(`${p.aviso.alumno}|${p.aviso.seccion}`)!;
  await tx`insert into announcement (section_representative_id, title, message)
    select ${autor}, ${p.aviso.titulo}, ${p.aviso.mensaje}
    where not exists (select 1 from announcement where section_representative_id = ${autor} and title = ${p.aviso.titulo})`;

  // Asesorías. Los ON CONFLICT llevan el mismo predicado que los índices únicos parciales.
  for (const as of p.asesorias) {
    const docente = docenteId.get(as.docente)!;
    if (as.tipo === "recurring") {
      await tx`insert into course_advising_session
          (course_offering_id, section_id, teacher_id, day_of_week, start_time, end_time, classroom, meeting_url, modality, kind)
        values (${ofertaId.get(as.seccion)!}, null, ${docente}, ${as.dia}, ${as.inicio}, ${as.fin}, ${as.aula}, ${as.enlace}, ${as.modalidad}, 'recurring')
        on conflict (course_offering_id, teacher_id, day_of_week, start_time) where section_id is null and kind = 'recurring'
        do update set end_time = excluded.end_time, classroom = excluded.classroom,
          meeting_url = excluded.meeting_url, modality = excluded.modality`;
    } else {
      const extra = await uno<{ id: number }>(tx`
        insert into course_advising_session
          (course_offering_id, section_id, teacher_id, day_of_week, start_time, end_time, classroom, meeting_url,
           modality, kind, session_date, capacity)
        values (${ofertaId.get(as.seccion)!}, ${seccionId.get(as.seccion)!}, ${docente}, ${as.dia}, ${as.inicio}, ${as.fin},
          ${as.aula}, ${as.enlace}, ${as.modalidad}, 'extra', ${as.fecha}, ${as.cupo})
        on conflict (section_id, teacher_id, session_date, start_time) where kind = 'extra'
        do update set end_time = excluded.end_time, classroom = excluded.classroom, meeting_url = excluded.meeting_url,
          modality = excluded.modality, capacity = excluded.capacity
        returning id`);
      for (const r of p.rsvp.filter((x) => x.seccion === as.seccion)) {
        await tx`insert into advising_rsvp (advising_session_id, student_id)
          values (${extra.id}, ${alumnoId.get(r.alumno)!}) on conflict (advising_session_id, student_id) do nothing`;
      }
    }
  }

  // Bloques propios: sin llave natural en la tabla, así que se busca por alumno y título.
  for (const b of p.bloques) {
    const st = alumnoId.get(b.alumno)!;
    await tx`insert into student_time_block (student_id, title, color_hex, days_of_week, start_time, end_time, start_date, end_date)
      select ${st}, ${b.titulo}, ${b.color}, ${`{${b.dias.join(",")}}`}::smallint[], ${b.inicio}, ${b.fin}, ${b.desde}, ${b.hasta}
      where not exists (select 1 from student_time_block where student_id = ${st} and title = ${b.titulo})`;
  }
}

const TABLAS_RESUMEN = [
  "career", "curriculum", "course", "curriculum_course", "course_prerequisite", "specialty",
  "curriculum_course_specialty", "assessment_type", "academic_period", "academic_week", "course_offering",
  "syllabus", "assessment", "teacher", "section", "schedule_session", "app_user", "student", "enrollment",
  "student_score", "student_course_progress", "student_specialty", "section_representative", "announcement",
  "course_advising_session", "advising_rsvp", "student_time_block", "user_social_link",
];

async function main() {
  console.log(`\n=== Seed de laboratorio · ${APPLY ? "APPLY" : "DRY-RUN"} ===\n`);

  // Nunca sobre una base con personas que no sean del laboratorio.
  const ajenos = await uno<{ n: number }>(sql`
    select count(*)::int as n from app_user where code !~ '^2099[0-9]{4}$' and code !~ '^lab\\.'`);
  if (ajenos.n > 0) fallar(`La base tiene ${ajenos.n} cuentas que no son del laboratorio. No se siembra nada.`);

  const enRiesgo = plan.alumnos.flatMap((a) => a.matriculas.filter((m) => m.perfil !== "normal").map((m) => `${a.codigo}@${m.seccion} (${m.perfil})`));
  console.log(`Catálogo: ${catalogo.course.length} cursos, ${catalogo.curriculum_course.length} en la malla, ${catalogo.specialty.length} especialidades.`);
  console.log(`Período ${plan.periodo.codigo}: ${plan.periodo.inicio} a ${plan.periodo.fin}, ${plan.semanas.length} semanas; horas de asistencia a la semana ${plan.semanasTranscurridas}.`);
  console.log(`Sintéticos: ${plan.docentes.length} docentes, ${plan.secciones.length} secciones, ${plan.alumnos.length} alumnos, ${plan.alumnos.reduce((n, a) => n + a.matriculas.length, 0)} matrículas.`);
  console.log(`Asistencia comprometida: ${enRiesgo.join(", ") || "ninguna"}.`);

  if (!APPLY) {
    console.log(`\n(DRY-RUN) No se escribió nada. Corre con --apply para sembrar.\n`);
    return;
  }

  const [hashAlumno, hashDocente] = await Promise.all([
    bcrypt.hash(PASSWORD_ALUMNO, BCRYPT_COST),
    bcrypt.hash(PASSWORD_DOCENTE, BCRYPT_COST),
  ]);
  await sql.begin(async (tx) => {
    await sembrarCatalogo(tx);
    await sembrarSinteticos(tx, plan, hashAlumno, hashDocente);
  });

  console.log("\n✓ Seed aplicado. Filas por tabla:");
  for (const tabla of TABLAS_RESUMEN) {
    const { n } = await uno<{ n: number }>(sql`select count(*)::int as n from ${sql(tabla)}`);
    console.log(`  ${tabla.padEnd(30)} ${n}`);
  }
  console.log();
}

main()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("\n✗ El seed falló (ROLLBACK):", e instanceof Error ? e.message : e);
    await sql.end().catch(() => {});
    process.exit(1);
  });
