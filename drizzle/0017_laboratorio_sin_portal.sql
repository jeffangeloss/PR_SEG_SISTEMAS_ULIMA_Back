-- Variante de laboratorio (rama laboratorio/sin-portal, desde v2.1.0) · Retiro del esquema
-- que solo existía por la integración con el portal de la Universidad de Lima (miUlima y
-- sílabos Domino) y por el interruptor del modo estático. Qué se retiró y por qué está en
-- LABORATORIO.md.
--
-- SOLO para la base del laboratorio. NUNCA contra la base de producción de ULima++.
-- DESTRUCTIVA, porque borra tablas y columnas con sus datos. Supone aplicada la cadena de
-- v2.1.0 (journal hasta la 0009, 0001_course_offering_total_hours y 0010 a 0016) y sobre
-- ella es idempotente, porque cada DROP lleva IF EXISTS. Se aplica con
--
--   bun run db:apply drizzle/0017_laboratorio_sin_portal.sql
--
-- y no con db:migrate ni db:generate, porque drizzle/meta/_journal.json sigue en la 0009.
-- Las migraciones que crearon estos objetos (0004, 0006, 0008, 0010, 0011, 0015 y 0016) no
-- se editan y quedan como registro de v2.1.0.
--
-- La asistencia se conserva. enrollment.attended_hours, absent_hours y total_hours, y
-- course_offering.total_hours, con sus CHECK, siguen en pie porque las leen el horario, el
-- detalle del curso y el riesgo de asistencia; en el laboratorio las llena el seed sintético.

-- 1. Tablas. Ninguna tabla que se queda las referencia, así que van sin CASCADE a propósito.
--    Si algo inesperado dependiera de ellas, la transacción de db:apply falla entera.
DROP TABLE IF EXISTS student_portal_score;          -- 0015 · notas leídas del Aula Virtual
DROP TABLE IF EXISTS section_representative_claim;  -- 0006 · delegados pendientes del portal
DROP TABLE IF EXISTS student_record_entry;          -- 0011 · récord académico del portal
DROP TABLE IF EXISTS student_academic_snapshot;     -- 0011 · información académica del portal
DROP TABLE IF EXISTS student_period_summary;        -- 0011 · resumen por ciclo del portal
DROP TABLE IF EXISTS course_equivalence;            -- 0008 · emparejamiento del récord
DROP TABLE IF EXISTS app_setting;                   -- 0016 · interruptor del modo estático

-- 2. enrollment: nota final del récord (0004) y horas de lectura de la recarga (0015).
ALTER TABLE enrollment DROP CONSTRAINT IF EXISTS chk_enrollment_final_grade;
ALTER TABLE enrollment
  DROP COLUMN IF EXISTS final_grade,
  DROP COLUMN IF EXISTS portal_grades_read_at,
  DROP COLUMN IF EXISTS portal_attendance_read_at;

-- 3. course: horas semanales del plan (0010), que solo usaba la importación del portal.
ALTER TABLE course DROP CONSTRAINT IF EXISTS chk_course_weekly_hours;
ALTER TABLE course DROP COLUMN IF EXISTS weekly_hours;

-- No se tocan el enum representative_position (lo usa section_representative), el unique
-- uq_curriculum_course_id_curriculum (es del baseline) ni las filas de las tablas que quedan.
