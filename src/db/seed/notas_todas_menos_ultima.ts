// Seed — NOTAS OFICIALES (student_score) para TODOS los cursos y TODOS los
// alumnos del período académico ACTIVO: se llenan TODAS las evaluaciones MENOS
// la última de cada curso (semana 15 típicamente). Simula un semestre en curso
// donde la evaluación final aún no ha sido publicada por el docente.
//
// Human-gated: correr con datos móviles (el wifi de la ULima bloquea el 5432) y
// con backup previo (pg_dump de student_score).
//
//   bun run src/db/seed/notas_todas_menos_ultima.ts           # DRY-RUN: plan, no escribe
//   bun run src/db/seed/notas_todas_menos_ultima.ts --apply   # aplica en UNA transacción
//
// Reglas:
//   - "Última evaluación" de un curso = el assessment con mayor week_number del
//     syllabus (desempate: mayor id). Se DEJA sin nota.
//   - Las notas ya existentes se PRESERVAN (on conflict do nothing): no se pisan
//     los escenarios diseñados a mano (p. ej. los alumnos críticos de la 855 en
//     seeds anteriores, o notas cargadas por el docente).
//   - Cualquier nota que exista sobre la ÚLTIMA evaluación se BORRA, para que la
//     final quede vacía en toda la clase (igual que hacía el seed de la 855 con EV03).
//   - Las notas nuevas se generan deterministas por (código, evaluación) en un
//     rango realista y mayormente aprobatorio, para no inundar de alertas
//     "riesgo crítico" a toda la facultad.
import "dotenv/config";
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");

/** Hash entero estable (FNV-1a de 32 bits) de una cadena. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Nota determinista para (código de alumno, código de evaluación).
 * Cada alumno tiene un "nivel base" (12..17) y cada evaluación le suma un ruido
 * de -2..+2; se recorta a [8, 20]. Resultado: notas ~10..19, casi siempre
 * aprobatorias, con variedad natural. Entero (la BD guarda decimal(5,2)).
 */
export function gradeFor(studentCode: string, assessCode: string): number {
  const base = 12 + (hash32(studentCode) % 6); // 12..17
  const delta = (hash32(`${studentCode}:${assessCode}`) % 5) - 2; // -2..+2
  return Math.max(8, Math.min(20, base + delta));
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function run(db: postgres.Sql | postgres.TransactionSql) {
  // 1) Período activo.
  const [period] = await db`select id, code from academic_period where is_active = true`;
  if (!period) throw new Error("No hay período académico activo");
  console.log(`Período activo: ${period.code} (id ${period.id})\n`);

  // 2) Última evaluación por syllabus (la que se deja vacía).
  const lastAssessments = await db`
    select distinct on (sy.id) a.id as assess_id, sy.id as syllabus_id
    from assessment a
    join syllabus sy on sy.id = a.syllabus_id
    join course_offering co on co.id = sy.course_offering_id
    where co.academic_period_id = ${period.id}
    order by sy.id, a.week_number desc, a.id desc`;
  const lastIds = new Set(lastAssessments.map((r) => Number(r.assess_id)));

  // 3) Evaluaciones a llenar (todas menos la última) del período, con su código.
  const fillable = await db`
    select a.id, a.code, a.week_number, a.weight, sy.course_offering_id
    from assessment a
    join syllabus sy on sy.id = a.syllabus_id
    join course_offering co on co.id = sy.course_offering_id
    where co.academic_period_id = ${period.id}
    order by sy.course_offering_id, a.week_number`;
  const fillableByOffering = new Map<number, typeof fillable>();
  for (const a of fillable) {
    if (lastIds.has(Number(a.id))) continue;
    const off = Number(a.course_offering_id);
    if (!fillableByOffering.has(off)) fillableByOffering.set(off, [] as any);
    fillableByOffering.get(off)!.push(a);
  }

  // 4) Matrículas activas del período (con código de alumno y su offering).
  const enrollments = await db`
    select e.id as enrollment_id, au.code as student_code, au.full_name,
           s.course_offering_id, s.code as section_code, c.name as course_name
    from enrollment e
    join student st on st.id = e.student_id
    join app_user au on au.id = st.user_id
    join section s on s.id = e.section_id
    join course_offering co on co.id = s.course_offering_id
    join course c on c.id = co.course_id
    where co.academic_period_id = ${period.id} and e.status = 'active'`;

  // 5) Insertar notas (preservando existentes) + acumular reporte por sección.
  const perSection = new Map<string, { course: string; sec: string; students: Set<number>; inserted: number }>();
  let inserted = 0;
  let attempted = 0;

  for (const enr of enrollments) {
    const off = Number(enr.course_offering_id);
    const assessments = fillableByOffering.get(off) ?? [];
    const key = `${enr.course_offering_id}:${enr.section_code}`;
    if (!perSection.has(key)) {
      perSection.set(key, {
        course: enr.course_name as string,
        sec: enr.section_code as string,
        students: new Set(),
        inserted: 0,
      });
    }
    perSection.get(key)!.students.add(Number(enr.enrollment_id));

    for (const a of assessments) {
      const value = gradeFor(enr.student_code as string, a.code as string);
      const [row] = await db`
        insert into student_score (enrollment_id, assessment_id, value)
        values (${enr.enrollment_id}, ${a.id}, ${value})
        on conflict (enrollment_id, assessment_id) do nothing
        returning id`;
      attempted++;
      if (row) {
        inserted++;
        perSection.get(key)!.inserted++;
      }
    }
  }

  // 6) Limpiar notas sobre la ÚLTIMA evaluación (la final debe quedar vacía).
  const clearedRows = await db`
    delete from student_score
    where assessment_id in ${db(Array.from(lastIds))}
    returning id`;
  const cleared = clearedRows.length;

  // 7) Reporte.
  const sections = Array.from(perSection.values())
    .map((s) => ({
      course: s.course.slice(0, 34),
      sec: s.sec,
      alumnos: s.students.size,
      "notas+": s.inserted,
    }))
    .sort((a, b) => a.course.localeCompare(b.course));
  console.table(sections);
  console.log(
    `\nSecciones con alumnos: ${sections.length}` +
      `\nMatrículas activas: ${enrollments.length}` +
      `\nNotas intentadas (todas menos la última): ${attempted}` +
      `\nNotas NUEVAS insertadas: ${inserted}` +
      `\nNotas preservadas (ya existían): ${attempted - inserted}` +
      `\nNotas borradas sobre la última evaluación: ${cleared}`,
  );

  // Muestra: las notas de Jeff (student_id 6) tras el seed.
  const jeff = await db`
    select c.name as course, s.code as sec, a.code as ev, a.weight, ss.value
    from student_score ss
    join assessment a on a.id = ss.assessment_id
    join enrollment e on e.id = ss.enrollment_id
    join student st on st.id = e.student_id
    join section s on s.id = e.section_id
    join course_offering co on co.id = s.course_offering_id
    join course c on c.id = co.course_id
    where st.user_id = 6 and co.academic_period_id = ${period.id}
    order by c.name, a.week_number`;
  console.log("\nNotas de Jeff (student_id 6) tras el seed:");
  console.table(
    jeff.map((r) => ({ course: (r.course as string).slice(0, 28), sec: r.sec, ev: r.ev, weight: r.weight, value: r.value })),
  );
}

try {
  if (APPLY) {
    console.log("== APLICANDO (transacción) ==\n");
    await sql.begin(async (tx) => {
      await run(tx);
    });
    console.log("\n✅ Aplicado.");
  } else {
    console.log("== DRY-RUN (rollback al final, no escribe) ==\n");
    try {
      await sql.begin(async (tx) => {
        await run(tx);
        throw new Error("__DRYRUN_ROLLBACK__");
      });
    } catch (e) {
      if ((e as Error).message !== "__DRYRUN_ROLLBACK__") throw e;
    }
    console.log("\n(DRY-RUN: nada se escribió. Correr con --apply para aplicar.)");
  }
} catch (e) {
  console.error("ERROR:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
