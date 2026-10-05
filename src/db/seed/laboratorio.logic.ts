/**
 * Lógica PURA del seed de laboratorio (ver LABORATORIO.md). Sin base de datos, sin archivos y
 * sin reloj: el catálogo, los datos sintéticos y la fecha de hoy entran por parámetro, y el plan
 * sale por valor. Así se prueba en test/laboratorio/seed-laboratorio.test.ts.
 *
 * El runner (laboratorio.ts) solo valida el entorno, arma el plan con `planificar` y lo escribe.
 */
import type { DatosLab, PerfilAsistencia, SesionLab } from "./laboratorio.datos.js";

// ── catálogo (forma de laboratorio.catalogo.json) ────────────────────────────
export type CatalogoLab = {
  career: Array<{ id: number; code: string; name: string; faculty: string }>;
  curriculum: Array<{ id: number; career_id: number; name: string }>;
  course: Array<{ id: number; code: string; name: string; default_credit: number; origin_faculty: string | null }>;
  curriculum_course: Array<{
    id: number; curriculum_id: number; course_id: number; cycle: number;
    display_order: number; credit: number; category: string;
  }>;
  course_prerequisite: Array<{
    id: number; curriculum_id: number; curriculum_course_id: number; prerequisite_type: string;
    prerequisite_curriculum_course_id: number | null; required_cycle: number | null;
  }>;
  specialty: Array<{ id: number; career_id: number; name: string; description: string | null; is_active: boolean }>;
  curriculum_course_specialty: Array<{ curriculum_course_id: number; specialty_id: number }>;
  assessment_type: Array<{ id: number; name: string; abbreviation: string | null; description: string | null }>;
};

// ── fechas y horas ───────────────────────────────────────────────────────────
const DIA_MS = 86_400_000;

const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`);
const aIso = (d: Date) => d.toISOString().slice(0, 10);

export const sumarDias = (iso: string, dias: number): string =>
  aIso(new Date(aFecha(iso).getTime() + dias * DIA_MS));

/** Último día (domingo) del período: `semanas` semanas completas desde el lunes de inicio. */
export const finDelPeriodo = (inicio: string, semanas: number): string => sumarDias(inicio, semanas * 7 - 1);

export const semanasDelPeriodo = (inicio: string, semanas: number) =>
  Array.from({ length: semanas }, (_, i) => ({
    numero: i + 1,
    inicio: sumarDias(inicio, i * 7),
    fin: sumarDias(inicio, i * 7 + 6),
  }));

/**
 * Semanas del período que ya empezaron a la fecha `hoy`, contando la actual, entre `minimo` y
 * `semanas`. El mínimo existe para que el riesgo de asistencia tenga casos aunque el seed se
 * corra al comienzo del ciclo; LABORATORIO.md lo dice.
 */
export const semanasTranscurridas = (inicio: string, hoy: string, semanas: number, minimo: number): number => {
  const dias = Math.floor((aFecha(hoy).getTime() - aFecha(inicio).getTime()) / DIA_MS);
  const empezadas = Math.floor(dias / 7) + 1;
  return Math.min(semanas, Math.max(minimo, empezadas));
};

/** "08:30" → 510. */
export const minutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const duracionHoras = (s: SesionLab) => (minutos(s.fin) - minutos(s.inicio)) / 60;

export const horasSemanales = (sesiones: readonly SesionLab[]): number =>
  sesiones.reduce((total, s) => total + duracionHoras(s), 0);

/** Duración más frecuente de una sesión, la misma moda que usa attendance-risk (RS-BE-13). */
export const duracionModal = (sesiones: readonly SesionLab[]): number => {
  const cuenta = new Map<number, number>();
  for (const s of sesiones) cuenta.set(duracionHoras(s), (cuenta.get(duracionHoras(s)) ?? 0) + 1);
  let moda = 0;
  let veces = 0;
  for (const [horas, n] of [...cuenta].sort((a, b) => a[0] - b[0])) {
    if (n > veces) { moda = horas; veces = n; }
  }
  return moda;
};

const seCruzan = (a: SesionLab, b: SesionLab) =>
  a.dia === b.dia && minutos(a.inicio) < minutos(b.fin) && minutos(b.inicio) < minutos(a.fin);

// La grilla del horario pinta de 07:00 a 22:00 (chk_time_block_grilla).
const dentroDeLaGrilla = (inicio: string, fin: string) =>
  minutos(inicio) >= minutos("07:00") && minutos(fin) <= minutos("22:00") && minutos(inicio) < minutos(fin);

// ── determinismo ─────────────────────────────────────────────────────────────
/** FNV-1a de 32 bits: el mismo texto da siempre el mismo número, sin depender de Math.random. */
export const fnv1a = (texto: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

/**
 * Nota de una evaluación publicada. Un alumno con la asistencia comprometida en esa sección saca
 * de 05 a 09, para que también aparezca en riesgo académico; los demás, de 11 a 19.
 */
export const notaDeterminista = (codigo: string, seccion: string, evaluacion: string, perfil: PerfilAsistencia): number => {
  const h = fnv1a(`${codigo}|${seccion}|${evaluacion}`);
  return perfil === "normal" ? 11 + (h % 9) : 5 + (h % 5);
};

// ── asistencia ───────────────────────────────────────────────────────────────
/** Porcentaje de inasistencias permitido; el mismo corte por ciclo que attendance-risk.service.ts. */
export const limiteInasistencias = (ciclo: number): number => (ciclo >= 6 ? 35 : 25);

/**
 * Horas de una matrícula. `total` es el del curso completo; asistidas + inasistencias son las
 * horas ya transcurridas, así que nunca pasan de `total` (chk_enrollment_attendance_hours).
 *
 * - `en_riesgo`: le quedan 2 o 3 faltas antes del límite.
 * - `impedido`: superó el límite.
 * - `normal`: 0, 1 o 2 sesiones faltadas, según el código.
 * Si todavía no transcurrieron horas suficientes, las inasistencias se recortan a las transcurridas.
 */
export const horasDeAsistencia = (p: {
  codigo: string; seccion: string; perfil: PerfilAsistencia; ciclo: number;
  total: number; transcurridas: number; horasSesion: number;
}): { asistidas: number; inasistencias: number; total: number } => {
  const maximo = (p.total * limiteInasistencias(p.ciclo)) / 100;
  const objetivo =
    p.perfil === "en_riesgo" ? p.horasSesion * Math.floor((maximo - 2 * p.horasSesion) / p.horasSesion)
    : p.perfil === "impedido" ? p.horasSesion * (Math.floor(maximo / p.horasSesion) + 1)
    : p.horasSesion * (fnv1a(`${p.codigo}|${p.seccion}|asistencia`) % 3);
  const inasistencias = Math.min(Math.max(0, objetivo), p.transcurridas);
  return { asistidas: p.transcurridas - inasistencias, inasistencias, total: p.total };
};

// ── malla ────────────────────────────────────────────────────────────────────
export type EstadoCurso = "in_progress" | "approved" | "failed";

/**
 * Avance de malla coherente con el ciclo: lo que lleva está `in_progress`; los obligatorios de
 * ciclos anteriores, `approved`, salvo los desaprobados, que quedan `failed`. Los electivos de
 * ciclos anteriores no se dan por aprobados, porque nadie lleva todos.
 */
export const progresoDeMalla = (
  nivel: number,
  malla: CatalogoLab["curriculum_course"],
  inscritos: ReadonlySet<number>,
  desaprobados: ReadonlySet<number>,
): Array<{ curriculumCourseId: number; estado: EstadoCurso }> =>
  malla.flatMap<{ curriculumCourseId: number; estado: EstadoCurso }>((cc) => {
    if (inscritos.has(cc.id)) return [{ curriculumCourseId: cc.id, estado: "in_progress" }];
    if (desaprobados.has(cc.id)) return [{ curriculumCourseId: cc.id, estado: "failed" }];
    if (cc.cycle < nivel && cc.category !== "elective") return [{ curriculumCourseId: cc.id, estado: "approved" }];
    return [];
  });

// ── validación ───────────────────────────────────────────────────────────────
const CODIGO_ALUMNO = /^2099\d{4}$/;
const CUENTA_DOCENTE = /^lab\.[a-z0-9]+$/;

const mallaDe = (catalogo: CatalogoLab) => {
  const porCodigo = new Map(catalogo.course.map((c) => [c.code, c]));
  const ccPorCurso = new Map(catalogo.curriculum_course.map((cc) => [cc.course_id, cc]));
  return (codigo: string) => {
    const curso = porCodigo.get(codigo);
    const cc = curso ? ccPorCurso.get(curso.id) : undefined;
    return curso && cc ? { curso, cc } : null;
  };
};

/**
 * Problemas de los datos sintéticos frente al catálogo. Vacío = se pueden sembrar. El runner
 * aborta si encuentra alguno, antes de abrir la transacción.
 */
export const validarDatos = (datos: DatosLab, catalogo: CatalogoLab): string[] => {
  const problemas: string[] = [];
  const buscar = mallaDe(catalogo);

  if (JSON.stringify(datos).toLowerCase().includes("ulima")) {
    problemas.push("los datos sintéticos mencionan «ulima»");
  }

  // Docentes
  const docentes = new Map(datos.docentes.map((d) => [d.clave, d]));
  for (const d of datos.docentes) {
    if (d.cuenta !== null && !CUENTA_DOCENTE.test(d.cuenta)) problemas.push(`cuenta docente fuera del patrón lab.*: ${d.cuenta}`);
    if (!d.correo.endsWith("@laboratorio.test")) problemas.push(`correo de docente fuera de @laboratorio.test: ${d.correo}`);
  }
  if (docentes.size !== datos.docentes.length) problemas.push("hay docentes con la misma clave");

  // Secciones
  const secciones = new Map(datos.secciones.map((s) => [s.codigo, s]));
  const jps = new Set<string>();
  for (const s of datos.secciones) {
    if (!buscar(s.curso)) problemas.push(`${s.codigo}: el curso ${s.curso} no está en la malla del catálogo`);
    if (!docentes.has(s.docente)) problemas.push(`${s.codigo}: docente desconocido ${s.docente}`);
    if (s.jp !== null) {
      if (!docentes.has(s.jp)) problemas.push(`${s.codigo}: JP desconocido ${s.jp}`);
      if (s.jp === s.docente) problemas.push(`${s.codigo}: el JP no puede ser el profesor`);
      if (jps.has(s.jp)) problemas.push(`${s.codigo}: el JP ${s.jp} ya tiene otra sección`);
      jps.add(s.jp);
    }
    for (const ses of s.sesiones) {
      if (!dentroDeLaGrilla(ses.inicio, ses.fin)) problemas.push(`${s.codigo}: sesión fuera de 07:00-22:00`);
    }
    if (new Set(s.sesiones.map((ses) => `${ses.dia}|${ses.inicio}`)).size !== s.sesiones.length) {
      problemas.push(`${s.codigo}: dos sesiones el mismo día a la misma hora`);
    }
  }
  if (secciones.size !== datos.secciones.length) problemas.push("hay secciones con el mismo código");
  if (new Set(datos.secciones.map((s) => s.curso)).size !== datos.secciones.length) {
    problemas.push("hay dos secciones del mismo curso");
  }

  // Evaluaciones
  const tipos = new Set(catalogo.assessment_type.map((t) => t.name));
  const pesos = datos.evaluaciones.reduce((total, e) => total + e.peso, 0);
  if (pesos !== 100) problemas.push(`los pesos de las evaluaciones suman ${pesos}, no 100`);
  for (const e of datos.evaluaciones) {
    if (!tipos.has(e.tipo)) problemas.push(`${e.codigo}: el tipo «${e.tipo}» no está en el catálogo`);
    if (e.semana < 1 || e.semana > datos.periodo.semanas) problemas.push(`${e.codigo}: semana fuera del período`);
  }

  // Alumnos
  const activas = new Set(catalogo.specialty.filter((s) => s.is_active).map((s) => s.name));
  const codigos = new Set<string>();
  for (const a of datos.alumnos) {
    if (!CODIGO_ALUMNO.test(a.codigo)) problemas.push(`código de alumno fuera de 2099xxxx: ${a.codigo}`);
    if (codigos.has(a.codigo)) problemas.push(`código de alumno repetido: ${a.codigo}`);
    codigos.add(a.codigo);
    if (a.nivel < 1 || a.nivel > 10) problemas.push(`${a.codigo}: nivel ${a.nivel} fuera de 1-10`);
    if (a.especialidad !== null && !activas.has(a.especialidad)) {
      problemas.push(`${a.codigo}: la especialidad «${a.especialidad}» no está activa en el catálogo`);
    }

    const suyas = a.secciones.flatMap((c) => secciones.get(c) ?? []);
    if (suyas.length !== a.secciones.length) problemas.push(`${a.codigo}: matrícula en una sección que no existe`);
    const sesiones = suyas.flatMap((s) => s.sesiones);
    for (let i = 0; i < sesiones.length; i++) {
      for (let j = i + 1; j < sesiones.length; j++) {
        if (seCruzan(sesiones[i], sesiones[j])) problemas.push(`${a.codigo}: choque de horario`);
      }
    }
    for (const seccion of Object.keys(a.asistencia)) {
      if (!a.secciones.includes(seccion)) problemas.push(`${a.codigo}: perfil de asistencia en ${seccion}, donde no está matriculado`);
    }

    // Requisitos de lo que lleva, contra el avance que se le va a sembrar.
    const inscritos = new Set(suyas.flatMap((s) => buscar(s.curso)?.cc.id ?? []));
    const desaprobados = new Set(a.desaprobados.flatMap((c) => buscar(c)?.cc.id ?? []));
    if (desaprobados.size !== a.desaprobados.length) problemas.push(`${a.codigo}: desaprobó un curso que no está en la malla`);
    const aprobados = new Set(
      progresoDeMalla(a.nivel, catalogo.curriculum_course, inscritos, desaprobados)
        .filter((p) => p.estado === "approved")
        .map((p) => p.curriculumCourseId),
    );
    for (const ccId of inscritos) {
      for (const req of catalogo.course_prerequisite.filter((r) => r.curriculum_course_id === ccId)) {
        const cumple = req.prerequisite_type === "course"
          ? aprobados.has(req.prerequisite_curriculum_course_id ?? -1)
          : a.nivel - 1 >= (req.required_cycle ?? Infinity);
        if (!cumple) problemas.push(`${a.codigo}: no cumple un requisito del curso de malla ${ccId}`);
      }
    }
  }

  // Delegados, aviso, asesorías, confirmaciones y bloques
  const alumnos = new Map(datos.alumnos.map((a) => [a.codigo, a]));
  const matriculado = (codigo: string, seccion: string) => alumnos.get(codigo)?.secciones.includes(seccion) ?? false;
  const cargos = new Set<string>();
  for (const r of datos.representantes) {
    if (!matriculado(r.alumno, r.seccion)) problemas.push(`${r.alumno}: es ${r.cargo} de ${r.seccion} sin estar matriculado`);
    if (cargos.has(`${r.seccion}|${r.cargo}`)) problemas.push(`${r.seccion}: dos ${r.cargo}`);
    cargos.add(`${r.seccion}|${r.cargo}`);
  }
  if (!datos.representantes.some((r) => r.alumno === datos.aviso.alumno && r.seccion === datos.aviso.seccion)) {
    problemas.push("el aviso no lo publica un representante de su sección");
  }
  for (const as of datos.asesorias) {
    const s = secciones.get(as.seccion);
    if (!s || (s.docente !== as.docente && s.jp !== as.docente)) problemas.push(`asesoría de ${as.docente} en ${as.seccion}, que no dicta`);
    if (!dentroDeLaGrilla(as.inicio, as.fin)) problemas.push(`asesoría en ${as.seccion} fuera de 07:00-22:00`);
    if (as.tipo === "extra" && (as.semana === null || as.semana < 1 || as.semana > datos.periodo.semanas)) {
      problemas.push(`asesoría extra en ${as.seccion} sin semana válida`);
    }
  }
  for (const r of datos.rsvp) {
    if (!matriculado(r.alumno, r.seccion)) problemas.push(`${r.alumno}: confirma una asesoría de ${r.seccion} sin estar matriculado`);
    if (!datos.asesorias.some((as) => as.tipo === "extra" && as.seccion === r.seccion)) problemas.push(`${r.seccion}: confirmación sin asesoría extra`);
  }
  for (const b of datos.bloques) {
    if (!alumnos.has(b.alumno)) problemas.push(`bloque de un alumno que no existe: ${b.alumno}`);
    if (!dentroDeLaGrilla(b.inicio, b.fin)) problemas.push(`bloque «${b.titulo}» fuera de 07:00-22:00`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(b.color)) problemas.push(`bloque «${b.titulo}» con color inválido`);
    if (b.dias.length === 0 || b.dias.some((d) => d < 1 || d > 7)) problemas.push(`bloque «${b.titulo}» con días inválidos`);
  }

  return problemas;
};

// ── plan ─────────────────────────────────────────────────────────────────────
export type PlanLab = ReturnType<typeof planificar>;

/**
 * Todo lo que el runner escribe, ya resuelto contra el catálogo. Supone datos válidos: el
 * runner llama antes a `validarDatos`.
 */
export const planificar = (datos: DatosLab, catalogo: CatalogoLab, hoy: string) => {
  const buscar = mallaDe(catalogo);
  const { periodo } = datos;
  const fin = finDelPeriodo(periodo.inicio, periodo.semanas);
  const semanas = semanasDelPeriodo(periodo.inicio, periodo.semanas);
  const transcurridas = semanasTranscurridas(periodo.inicio, hoy, periodo.semanas, datos.semanasTranscurridasMinimas);

  const secciones = datos.secciones.map((s) => {
    const { curso, cc } = buscar(s.curso)!;
    const semanal = horasSemanales(s.sesiones);
    return {
      ...s,
      cursoId: curso.id,
      nombreCurso: curso.name,
      curriculumCourseId: cc.id,
      ciclo: cc.cycle,
      // course_offering.total_hours: las horas del curso en todo el período.
      totalHoras: semanal * periodo.semanas,
      horasTranscurridas: semanal * transcurridas,
      horasSesion: duracionModal(s.sesiones),
      silabo: {
        titulo: `Sílabo de laboratorio: ${curso.name}`.slice(0, 150),
        driveFileId: `lab-silabo-${s.curso}`,
        driveFileUrl: `https://laboratorio.test/silabos/${s.curso}.pdf`,
      },
    };
  });
  const seccion = new Map(secciones.map((s) => [s.codigo, s]));

  const tipoId = new Map(catalogo.assessment_type.map((t) => [t.name, t.id]));
  const evaluaciones = datos.evaluaciones.map((e) => ({ ...e, tipoId: tipoId.get(e.tipo)! }));
  const especialidadId = new Map(catalogo.specialty.map((s) => [s.name, s.id]));

  const alumnos = datos.alumnos.map((a) => {
    const matriculas = a.secciones.map((codigo) => {
      const s = seccion.get(codigo)!;
      const perfil = a.asistencia[codigo] ?? "normal";
      return {
        seccion: codigo,
        perfil,
        ...horasDeAsistencia({
          codigo: a.codigo, seccion: codigo, perfil, ciclo: s.ciclo,
          total: s.totalHoras, transcurridas: s.horasTranscurridas, horasSesion: s.horasSesion,
        }),
      };
    });
    const notas = matriculas.flatMap((m) =>
      evaluaciones
        .filter((e) => e.publicada)
        .map((e) => ({ seccion: m.seccion, evaluacion: e.codigo, valor: notaDeterminista(a.codigo, m.seccion, e.codigo, m.perfil) })),
    );
    const inscritos = new Set(matriculas.map((m) => seccion.get(m.seccion)!.curriculumCourseId));
    const desaprobados = new Set(a.desaprobados.map((c) => buscar(c)!.cc.id));
    return {
      codigo: a.codigo,
      nombre: a.nombre,
      correo: `${a.codigo}@laboratorio.test`,
      nivel: a.nivel,
      setupCompleto: a.setupCompleto,
      networking: a.networking,
      especialidadId: a.especialidad === null ? null : especialidadId.get(a.especialidad)!,
      matriculas,
      notas,
      progreso: progresoDeMalla(a.nivel, catalogo.curriculum_course, inscritos, desaprobados),
    };
  });

  const asesorias = datos.asesorias.map((as) => ({
    ...as,
    cursoId: seccion.get(as.seccion)!.cursoId,
    // La extra cae el día `dia` de su semana; la recurrente no tiene fecha.
    fecha: as.semana === null ? null : sumarDias(semanas[as.semana - 1].inicio, as.dia - 1),
  }));

  return {
    periodo: { codigo: periodo.codigo, inicio: periodo.inicio, fin },
    semanas,
    semanasTranscurridas: transcurridas,
    docentes: datos.docentes,
    secciones,
    evaluaciones,
    alumnos,
    representantes: datos.representantes,
    aviso: datos.aviso,
    asesorias,
    rsvp: datos.rsvp,
    bloques: datos.bloques.map((b) => ({ ...b, desde: periodo.inicio, hasta: fin })),
  };
};
