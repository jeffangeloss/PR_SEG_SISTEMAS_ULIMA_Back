import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const curriculumSimulationStatusEnum = pgEnum("curriculum_simulation_status", [
  "planned",
  "simulated_completed",
  // HU19: simular "des-aprobar" un curso real (volverlo disponible/no tomado).
  "simulated_available",
]);

export const studentCourseStatusEnum = pgEnum("student_course_status", [
  "in_progress",
  "approved",
  "failed",
  "withdrawn",
]);

export const representativePositionEnum = pgEnum("representative_position", [
  "delegate",
  "subdelegate",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "withdrawn",
  "completed",
]);

export const alertTypeEnum = pgEnum("alert_type", ["academic_risk", "high_load"]);

export const advisingModalityEnum = pgEnum("advising_modality", [
  "classroom",
  "virtual",
  "hybrid",
]);

// HU18: distingue asesorías recurrentes (carga administrativa ya existente) de
// las extras puntuales que un docente publica para una fecha concreta.
export const advisingKindEnum = pgEnum("advising_kind", [
  "recurring",
  "extra",
]);

export const courseCategoryEnum = pgEnum("course_category", [
  "general_studies",
  "common",
  "faculty",
  "elective",
]);

export const prerequisiteTypeEnum = pgEnum("prerequisite_type", [
  "course",
  "completed_cycle",
]);

export const studentSpecialtyTypeEnum = pgEnum("student_specialty_type", [
  "primary",
  "interest",
]);

// HU networking (carnet): plataformas soportadas en el carnet de networking.
// `website`/`other` usan la etiqueta libre de user_social_link.label.
export const socialPlatformEnum = pgEnum("social_platform", [
  "linkedin",
  "instagram",
  "github",
  "x",
  "website",
  "other",
]);

export const appUser = pgTable("app_user", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  fullName: varchar("full_name", { length: 150 }).notNull(),
  institutionalEmail: varchar("institutional_email", { length: 150 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  googleId: varchar("google_id", { length: 255 }),
  tokenVersion: integer("token_version").notNull().default(1),
  // HU networking (carnet): opt-in explícito del usuario (alumno o docente) para
  // mostrar/compartir su carnet con sus redes. Default false = privado hasta que
  // acepte desde el perfil. Aplica a TODOS los usuarios (app_user es compartida).
  networkingOptIn: boolean("networking_opt_in").notNull().default(false),
  // Foto de perfil. Se guarda el IDENTIFICADOR de Cloudinary, no la URL: con la
  // URL guardada no se podría cambiar la transformación después (los avatares se
  // piden recortados a la cara y en varios tamaños) ni borrar la imagen, y
  // borrarla es lo que hace posible atender un "quítenme la foto".
  // NULL = sin foto: la app pinta las iniciales, como siempre.
  avatarPublicId: varchar("avatar_public_id", { length: 255 }),
  // Versión que devuelve Cloudinary al subir. Entra en la URL y hace de
  // rompe-caché: sin ella, reemplazar la foto dejaría la vieja en el CDN.
  avatarVersion: varchar("avatar_version", { length: 20 }),
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
});

// HU networking (carnet): redes sociales que un usuario decide compartir en su
// carnet. Una fila por plataforma; el carnet es la unión de las filas del
// usuario. El frontend solo debe mostrar el carnet si networking_opt_in = true.
export const userSocialLink = pgTable("user_social_link", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => appUser.id),
  platform: socialPlatformEnum("platform").notNull(),
  url: varchar("url", { length: 255 }).notNull(),
  // Etiqueta opcional, sobre todo para `website`/`other` (ej. "Portafolio").
  label: varchar("label", { length: 80 }),
}, (t) => ({
  // Un solo enlace por plataforma por usuario.
  uqUserSocialLinkPlatform: unique("uq_user_social_link_platform").on(t.userId, t.platform),
  idxUserSocialLinkUser: index("idx_user_social_link_user").on(t.userId),
}));

export const student = pgTable("student", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => appUser.id),
  careerId: integer("career_id").notNull(),
  curriculumId: integer("curriculum_id").notNull(),
  currentLevel: integer("current_level"),
  specialtySetupCompleted: boolean("specialty_setup_completed").notNull().default(false),
}, (t) => ({
  uqStudentIdCareer: unique("uq_student_id_career").on(t.id, t.careerId),
  uqStudentIdCurriculum: unique("uq_student_id_curriculum").on(t.id, t.curriculumId),
  chkStudentCurrentLevel: check("chk_student_current_level", sql`${t.currentLevel} IS NULL OR ${t.currentLevel} BETWEEN 1 AND 10`),
  idxStudentUserId: index("idx_student_user_id").on(t.userId),
  idxStudentCurriculumId: index("idx_student_curriculum_id").on(t.curriculumId),
}));

export const career = pgTable("career", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  faculty: varchar("faculty", { length: 120 }).notNull(),
});

export const teacher = pgTable("teacher", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  teacherCode: varchar("teacher_code", { length: 50 }).unique(),
  fullName: varchar("full_name", { length: 150 }).notNull(),
  institutionalEmail: varchar("institutional_email", { length: 150 }).unique(),
  // HU18: vínculo opcional a una cuenta para login docente. Nullable: los
  // profesores sin cuenta (la mayoría, dato referencial) siguen siendo válidos.
  userId: integer("user_id").unique().references(() => appUser.id),
});

export const specialty = pgTable("specialty", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  careerId: integer("career_id").notNull().references(() => career.id),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  uqSpecialtyCareerName: unique("uq_specialty_career_name").on(t.careerId, t.name),
}));

export const studentSpecialty = pgTable("student_specialty", {
  studentId: integer("student_id").notNull().references(() => student.id),
  specialtyId: integer("specialty_id").notNull().references(() => specialty.id),
  selectionType: studentSpecialtyTypeEnum("selection_type").notNull().default("interest"),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  pk: primaryKey({ columns: [t.studentId, t.specialtyId] }),
  idxStudentSpecialtyStudent: index("idx_student_specialty_student").on(t.studentId),
  uqStudentSpecialtyActivePrimary: uniqueIndex("uq_student_specialty_active_primary")
    .on(t.studentId)
    .where(sql`${t.selectionType} = 'primary' AND ${t.isActive} = TRUE`),
}));

export const curriculum = pgTable("curriculum", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  careerId: integer("career_id").notNull().unique().references(() => career.id),
  name: varchar("name", { length: 120 }).notNull(),
}, (t) => ({
  uqCurriculumIdCareer: unique("uq_curriculum_id_career").on(t.id, t.careerId),
}));

export const course = pgTable("course", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  defaultCredit: integer("default_credit").notNull(),
  originFaculty: varchar("origin_faculty", { length: 120 }),
}, (t) => ({
  chkCourseDefaultCredit: check("chk_course_default_credit", sql`${t.defaultCredit} > 0`),
}));

export const curriculumCourse = pgTable("curriculum_course", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  curriculumId: integer("curriculum_id").notNull().references(() => curriculum.id),
  courseId: integer("course_id").notNull().references(() => course.id),
  cycle: integer("cycle").notNull(),
  displayOrder: integer("display_order").notNull(),
  credit: integer("credit").notNull(),
  category: courseCategoryEnum("category").notNull().default("faculty"),
}, (t) => ({
  uqCurriculumCourse: unique("uq_curriculum_course").on(t.curriculumId, t.courseId),
  uqCurriculumCourseIdCurriculum: unique("uq_curriculum_course_id_curriculum").on(t.id, t.curriculumId),
  chkCurriculumCourseCycle: check("chk_curriculum_course_cycle", sql`${t.cycle} > 0`),
  chkCurriculumCourseDisplayOrder: check("chk_curriculum_course_display_order", sql`${t.displayOrder} > 0`),
  chkCurriculumCourseCredit: check("chk_curriculum_course_credit", sql`${t.credit} > 0`),
  idxCurriculumCourseCurriculum: index("idx_curriculum_course_curriculum").on(t.curriculumId),
}));

export const curriculumCourseSpecialty = pgTable("curriculum_course_specialty", {
  curriculumCourseId: integer("curriculum_course_id").notNull().references(() => curriculumCourse.id),
  specialtyId: integer("specialty_id").notNull().references(() => specialty.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.curriculumCourseId, t.specialtyId] }),
}));

export const coursePrerequisite = pgTable("course_prerequisite", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  curriculumId: integer("curriculum_id").notNull().references(() => curriculum.id),
  curriculumCourseId: integer("curriculum_course_id").notNull().references(() => curriculumCourse.id),
  prerequisiteType: prerequisiteTypeEnum("prerequisite_type").notNull(),
  prerequisiteCurriculumCourseId: integer("prerequisite_curriculum_course_id").references(() => curriculumCourse.id),
  requiredCycle: integer("required_cycle"),
}, (t) => ({
  uqCoursePrerequisiteCourse: uniqueIndex("uq_course_prerequisite_course")
    .on(t.curriculumCourseId, t.prerequisiteCurriculumCourseId)
    .where(sql`${t.prerequisiteCurriculumCourseId} IS NOT NULL`),
  uqCoursePrerequisiteCompletedCycle: uniqueIndex("uq_course_prerequisite_completed_cycle")
    .on(t.curriculumCourseId, t.prerequisiteType, t.requiredCycle)
    .where(sql`${t.requiredCycle} IS NOT NULL`),
  chkCoursePrerequisiteKind: check("chk_course_prerequisite_kind", sql`
    (${t.prerequisiteType} = 'course' AND ${t.prerequisiteCurriculumCourseId} IS NOT NULL AND ${t.requiredCycle} IS NULL)
    OR
    (${t.prerequisiteType} = 'completed_cycle' AND ${t.prerequisiteCurriculumCourseId} IS NULL AND ${t.requiredCycle} IS NOT NULL)
  `),
  chkCoursePrerequisiteRequiredCycle: check("chk_course_prerequisite_required_cycle", sql`${t.requiredCycle} IS NULL OR ${t.requiredCycle} > 0`),
  chkCoursePrerequisiteNotSelf: check("chk_course_prerequisite_not_self", sql`${t.prerequisiteCurriculumCourseId} IS NULL OR ${t.curriculumCourseId} <> ${t.prerequisiteCurriculumCourseId}`),
  idxCoursePrerequisiteCurriculumCourse: index("idx_course_prerequisite_curriculum_course").on(t.curriculumCourseId),
}));

export const studentCurriculumSimulation = pgTable("student_curriculum_simulation", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  curriculumId: integer("curriculum_id").notNull().references(() => curriculum.id),
  curriculumCourseId: integer("curriculum_course_id").notNull().references(() => curriculumCourse.id),
  status: curriculumSimulationStatusEnum("status").notNull(),
}, (t) => ({
  uqStudentCurriculumSimulation: unique("uq_student_curriculum_simulation").on(t.studentId, t.curriculumCourseId),
  idxStudentCurriculumSimulationStudent: index("idx_student_curriculum_simulation_student").on(t.studentId),
}));

export const academicPeriod = pgTable("academic_period", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  startDate: date("start_date", { mode: "date" }).notNull(),
  endDate: date("end_date", { mode: "date" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  chkAcademicPeriodDates: check("chk_academic_period_dates", sql`${t.startDate} < ${t.endDate}`),
  uqAcademicPeriodSingleActive: uniqueIndex("uq_academic_period_single_active")
    .on(t.isActive)
    .where(sql`${t.isActive} = TRUE`),
}));

export const courseOffering = pgTable("course_offering", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  academicPeriodId: integer("academic_period_id").notNull().references(() => academicPeriod.id),
  courseId: integer("course_id").notNull().references(() => course.id),
  totalHours: decimal("total_hours", { precision: 5, scale: 2 }).notNull().default("0"),
}, (t) => ({
  uqCourseOffering: unique("uq_course_offering").on(t.academicPeriodId, t.courseId),
  chkCourseOfferingTotalHours: check("chk_course_offering_total_hours", sql`${t.totalHours} >= 0`),
  idxCourseOfferingPeriod: index("idx_course_offering_period").on(t.academicPeriodId),
}));

export const syllabus = pgTable("syllabus", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  courseOfferingId: integer("course_offering_id").notNull().references(() => courseOffering.id),
  title: varchar("title", { length: 150 }),
  driveFileId: varchar("drive_file_id", { length: 120 }).notNull().unique(),
  driveFileUrl: varchar("drive_file_url", { length: 255 }).notNull(),
}, (t) => ({
  uqSyllabusCourseOffering: unique("uq_syllabus_course_offering").on(t.courseOfferingId),
}));

export const section = pgTable("section", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  courseOfferingId: integer("course_offering_id").notNull().references(() => courseOffering.id),
  teacherId: integer("teacher_id").notNull().references(() => teacher.id),
  code: varchar("code", { length: 30 }).notNull(),
  // HU18: jefe de práctica de la sección (0 o 1). El rol Profesor/JP se deriva
  // de qué columna referencia al teacher; no es un enum en la persona.
  jpId: integer("jp_id").references(() => teacher.id),
}, (t) => ({
  uqSectionOfferingCode: unique("uq_section_offering_code").on(t.courseOfferingId, t.code),
  uqSectionIdOffering: unique("uq_section_id_offering").on(t.id, t.courseOfferingId),
  idxSectionCourseOffering: index("idx_section_course_offering").on(t.courseOfferingId),
  // El JP no puede ser el profesor de su propia sección.
  chkSectionJpNotTeacher: check("chk_section_jp_not_teacher", sql`${t.jpId} IS NULL OR ${t.jpId} <> ${t.teacherId}`),
  // Un JP pertenece a una sola sección (índice único parcial: ignora NULLs).
  uqSectionJp: uniqueIndex("uq_section_jp").on(t.jpId).where(sql`${t.jpId} IS NOT NULL`),
}));

export const enrollment = pgTable("enrollment", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  sectionId: integer("section_id").notNull().references(() => section.id),
  status: enrollmentStatusEnum("status").notNull().default("active"),
  attendedHours: decimal("attended_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  absentHours: decimal("absent_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  totalHours: decimal("total_hours", { precision: 5, scale: 2 }).notNull().default("0"),
}, (t) => ({
  uqEnrollmentStudentSection: unique("uq_enrollment_student_section").on(t.studentId, t.sectionId),
  uqEnrollmentIdSection: unique("uq_enrollment_id_section").on(t.id, t.sectionId),
  chkEnrollmentAttendedHours: check("chk_enrollment_attended_hours", sql`${t.attendedHours} >= 0`),
  chkEnrollmentAbsentHours: check("chk_enrollment_absent_hours", sql`${t.absentHours} >= 0`),
  chkEnrollmentTotalHours: check("chk_enrollment_total_hours", sql`${t.totalHours} >= 0`),
  chkEnrollmentAttendanceHours: check("chk_enrollment_attendance_hours", sql`${t.attendedHours} + ${t.absentHours} <= ${t.totalHours}`),
  idxEnrollmentStudent: index("idx_enrollment_student").on(t.studentId),
}));

export const studentCourseProgress = pgTable("student_course_progress", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  curriculumId: integer("curriculum_id").notNull().references(() => curriculum.id),
  curriculumCourseId: integer("curriculum_course_id").notNull().references(() => curriculumCourse.id),
  status: studentCourseStatusEnum("status").notNull(),
}, (t) => ({
  uqStudentCourseProgress: unique("uq_student_course_progress").on(t.studentId, t.curriculumCourseId),
  idxStudentCourseProgressStudent: index("idx_student_course_progress_student").on(t.studentId),
  idxStudentCourseProgressCurriculumCourse: index("idx_student_course_progress_curriculum_course").on(t.curriculumCourseId),
}));

export const sectionRepresentative = pgTable("section_representative", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  sectionId: integer("section_id").notNull().references(() => section.id),
  enrollmentId: integer("enrollment_id").notNull().unique().references(() => enrollment.id),
  position: representativePositionEnum("position").notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  uqActiveSectionRepresentativePosition: uniqueIndex("uq_active_section_representative_position")
    .on(t.sectionId, t.position)
    .where(sql`${t.isActive} = TRUE`),
}));

export const academicWeek = pgTable("academic_week", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  academicPeriodId: integer("academic_period_id").notNull().references(() => academicPeriod.id),
  weekNumber: integer("week_number").notNull(),
  startDate: date("start_date", { mode: "date" }).notNull(),
  endDate: date("end_date", { mode: "date" }).notNull(),
}, (t) => ({
  uqAcademicWeekPeriodNumber: unique("uq_academic_week_period_number").on(t.academicPeriodId, t.weekNumber),
  chkAcademicWeekNumber: check("chk_academic_week_number", sql`${t.weekNumber} > 0`),
  chkAcademicWeekDates: check("chk_academic_week_dates", sql`${t.startDate} <= ${t.endDate}`),
}));

export const scheduleSession = pgTable("schedule_session", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  sectionId: integer("section_id").notNull().references(() => section.id),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  classroom: varchar("classroom", { length: 100 }),
  colorHex: varchar("color_hex", { length: 20 }),
}, (t) => ({
  uqScheduleSession: unique("uq_schedule_session").on(t.sectionId, t.dayOfWeek, t.startTime),
  chkScheduleSessionDay: check("chk_schedule_session_day", sql`${t.dayOfWeek} BETWEEN 1 AND 7`),
  chkScheduleSessionTime: check("chk_schedule_session_time", sql`${t.startTime} < ${t.endTime}`),
  idxScheduleSessionSection: index("idx_schedule_session_section").on(t.sectionId),
}));

export const courseAdvisingSession = pgTable("course_advising_session", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  courseOfferingId: integer("course_offering_id").notNull().references(() => courseOffering.id),
  sectionId: integer("section_id").references(() => section.id),
  teacherId: integer("teacher_id").notNull().references(() => teacher.id),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  classroom: varchar("classroom", { length: 100 }),
  meetingUrl: varchar("meeting_url", { length: 255 }),
  modality: advisingModalityEnum("modality").notNull().default("hybrid"),
  note: text("note"),
  // HU18: recurrentes (default) vs extras puntuales.
  kind: advisingKindEnum("kind").notNull().default("recurring"),
  // Fecha concreta de la asesoría extra (NULL en recurrentes).
  sessionDate: date("session_date", { mode: "string" }),
  // Cupo máximo opcional (NULL = sin límite).
  capacity: integer("capacity"),
}, (t) => ({
  // Los únicos de "día de semana + hora" solo aplican a recurrentes: dos extras
  // en fechas distintas pueden caer el mismo día de semana a la misma hora.
  uqCourseAdvisingSessionCourse: uniqueIndex("uq_course_advising_session_course")
    .on(t.courseOfferingId, t.teacherId, t.dayOfWeek, t.startTime)
    .where(sql`${t.sectionId} IS NULL AND ${t.kind} = 'recurring'`),
  uqCourseAdvisingSessionSection: uniqueIndex("uq_course_advising_session_section")
    .on(t.sectionId, t.teacherId, t.dayOfWeek, t.startTime)
    .where(sql`${t.sectionId} IS NOT NULL AND ${t.kind} = 'recurring'`),
  // Unicidad propia de extras: por fecha concreta.
  uqCourseAdvisingSessionExtra: uniqueIndex("uq_course_advising_session_extra")
    .on(t.sectionId, t.teacherId, t.sessionDate, t.startTime)
    .where(sql`${t.kind} = 'extra'`),
  chkCourseAdvisingDay: check("chk_course_advising_day", sql`${t.dayOfWeek} BETWEEN 1 AND 7`),
  chkCourseAdvisingTime: check("chk_course_advising_time", sql`${t.startTime} < ${t.endTime}`),
  // Coherencia extra ↔ fecha: una extra siempre tiene fecha.
  chkCourseAdvisingExtraDate: check("chk_course_advising_extra_date", sql`${t.kind} <> 'extra' OR ${t.sessionDate} IS NOT NULL`),
  chkCourseAdvisingCapacity: check("chk_course_advising_capacity", sql`${t.capacity} IS NULL OR ${t.capacity} > 0`),
  idxCourseAdvisingSessionCourseOffering: index("idx_course_advising_session_course_offering").on(t.courseOfferingId),
}));

// HU18/HU17: confirmación de asistencia de un estudiante a una asesoría.
export const advisingRsvp = pgTable("advising_rsvp", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  advisingSessionId: integer("advising_session_id").notNull().references(() => courseAdvisingSession.id),
  studentId: integer("student_id").notNull().references(() => student.id),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqAdvisingRsvp: unique("uq_advising_rsvp").on(t.advisingSessionId, t.studentId),
  idxAdvisingRsvpSession: index("idx_advising_rsvp_session").on(t.advisingSessionId),
}));

export const assessmentType = pgTable("assessment_type", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  abbreviation: varchar("abbreviation", { length: 30 }),
  description: text("description"),
});

export const assessment = pgTable("assessment", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  syllabusId: integer("syllabus_id").notNull().references(() => syllabus.id),
  assessmentTypeId: integer("assessment_type_id").notNull().references(() => assessmentType.id),
  code: varchar("code", { length: 30 }).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  weekNumber: integer("week_number").notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }).notNull(),
}, (t) => ({
  uqAssessmentSyllabusCode: unique("uq_assessment_syllabus_code").on(t.syllabusId, t.code),
  chkAssessmentWeekNumber: check("chk_assessment_week_number", sql`${t.weekNumber} > 0`),
  chkAssessmentWeight: check("chk_assessment_weight", sql`${t.weight} > 0 AND ${t.weight} <= 100`),
  idxAssessmentSyllabus: index("idx_assessment_syllabus").on(t.syllabusId),
}));

export const studentScore = pgTable("student_score", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollment.id),
  assessmentId: integer("assessment_id").notNull().references(() => assessment.id),
  value: decimal("value", { precision: 5, scale: 2 }),
}, (t) => ({
  uqStudentScore: unique("uq_student_score").on(t.enrollmentId, t.assessmentId),
  chkStudentScoreValue: check("chk_student_score_value", sql`${t.value} IS NULL OR ${t.value} BETWEEN 0 AND 20`),
  idxStudentScoreEnrollment: index("idx_student_score_enrollment").on(t.enrollmentId),
}));

// Notas SIMULADAS que el propio alumno ingresa en la calculadora para proyectar
// su promedio. Separadas de `student_score` (que guarda las notas seed) para no
// mezclar lo auto-reportado con lo "oficial". Persistidas en la BD (antes solo
// vivían en SharedPreferences del dispositivo) para que sigan al alumno entre
// dispositivos. Una fila por (matrícula, evaluación); `value` es obligatorio.
export const simulatedGrades = pgTable("simulated_grades", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollment.id),
  assessmentId: integer("assessment_id").notNull().references(() => assessment.id),
  value: decimal("value", { precision: 5, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqSimulatedGrade: unique("uq_simulated_grade").on(t.enrollmentId, t.assessmentId),
  chkSimulatedGradeValue: check("chk_simulated_grade_value", sql`${t.value} BETWEEN 0 AND 20`),
  idxSimulatedGradeEnrollment: index("idx_simulated_grade_enrollment").on(t.enrollmentId),
}));

export const announcement = pgTable("announcement", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  sectionRepresentativeId: integer("section_representative_id").notNull().references(() => sectionRepresentative.id),
  title: varchar("title", { length: 150 }).notNull(),
  message: text("message").notNull(),
  publishedAt: timestamp("published_at", { mode: "date" }).notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});

export const passwordResetToken = pgTable("password_reset_token", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => appUser.id),
  // SHA-256 (hex) del OTP de 6 dígitos; nunca se guarda el OTP en claro.
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { mode: "date", withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxPasswordResetTokenUser: index("idx_password_reset_token_user").on(t.userId),
}));

export const alert = pgTable("alert", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  type: alertTypeEnum("type").notNull(),
  title: varchar("title", { length: 150 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => ({
  idxAlertStudent: index("idx_alert_student").on(t.studentId),
}));

export const chatbotSession = pgTable("chatbot_session", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 100 }).notNull().default("Nueva conversacion"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => ({
  idxChatbotSessionStudent: index("idx_chatbot_session_student").on(t.studentId),
}));

export const chatbotMessage = pgTable("chatbot_message", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => chatbotSession.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 10 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => ({
  idxChatbotMessageSession: index("idx_chatbot_message_session").on(t.sessionId),
  // BR-CB-20 (migración 0013): los 10 últimos mensajes de la sesión sin ordenar
  // la sesión entera. Deja redundante al índice de arriba, que no se borra.
  idxChatbotMessageSessionCreated: index("idx_chatbot_message_session_created").on(t.sessionId, t.createdAt),
}));

/**
 * RS-BE-30 · Estado de un día que se sale del patrón de un bloque propio.
 *
 * Vive acá, pegado a su tabla, y no en el bloque de enums de arriba: su único
 * uso es `student_time_block_exception`.
 */
export const timeBlockExceptionStatusEnum = pgEnum("time_block_exception_status", [
  "cancelled",
  "moved",
]);

/**
 * RS-BE-30 · La REGLA de un bloque propio del alumno: prácticas, trabajo,
 * voluntariado. Título, color, días de la semana, horas y rango de fechas.
 *
 * No cuelga de `section`, `course_offering` ni `academic_period` a propósito
 * (decisión 5 de la spec): unas prácticas preprofesionales cruzan ciclos y
 * vacaciones, así que la vigencia son fechas propias del bloque. Es la primera
 * tabla del horario con fechas de inicio y fin suyas.
 *
 * Tampoco toca `schedule_session`: ahí `section_id` es NOT NULL, y sus filas
 * son las clases de la sección, no compromisos personales del alumno.
 *
 * `days_of_week` es un arreglo y no una tabla hija porque la expansión ocurre
 * en código (`time-blocks.logic.ts`) y nunca se pregunta desde SQL "qué
 * bloques caen el martes".
 */
export const studentTimeBlock = pgTable("student_time_block", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 60 }).notNull(),
  /** `#RRGGBB` elegido por el alumno: 7 caracteres exactos. */
  colorHex: varchar("color_hex", { length: 7 }).notNull(),
  /** 1 = lunes … 7 = domingo, la misma convención que `schedule_session.day_of_week`. */
  daysOfWeek: smallint("days_of_week").array().notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  chkTimeBlockHoras: check("chk_time_block_horas", sql`${t.endTime} > ${t.startTime}`),
  // 07:00-22:00 es lo que la grilla del horario puede pintar: un bloque fuera
  // de ese rango sería invisible en la app, así que se rechaza y no se guarda.
  chkTimeBlockGrilla: check(
    "chk_time_block_grilla",
    sql`${t.startTime} >= '07:00' AND ${t.endTime} <= '22:00'`,
  ),
  chkTimeBlockFechas: check("chk_time_block_fechas", sql`${t.endDate} >= ${t.startDate}`),
  // El `coalesce` no es adorno (RS-BE-30, "Modelo de datos" de la spec): sobre
  // un arreglo vacío `array_length` devuelve NULL, y una restricción que evalúa
  // a NULL se da por satisfecha, así que sin él un `days_of_week` vacío pasaría.
  chkTimeBlockDias: check(
    "chk_time_block_dias",
    sql`coalesce(array_length(${t.daysOfWeek}, 1), 0) BETWEEN 1 AND 7 AND ${t.daysOfWeek} <@ ARRAY[1,2,3,4,5,6,7]::smallint[]`,
  ),
  chkTimeBlockColor: check("chk_time_block_color", sql`${t.colorHex} ~ '^#[0-9A-Fa-f]{6}$'`),
  chkTimeBlockTitulo: check(
    "chk_time_block_titulo",
    sql`length(btrim(${t.title})) BETWEEN 1 AND 60`,
  ),
  idxTimeBlockStudent: index("idx_time_block_student").on(t.studentId),
}));

/**
 * RS-BE-30 · Lo que se sale de la regla: una fila por fecha.
 *
 * `cancelled` = ese día no va; `moved` = ese día tiene otras horas. Editar la
 * regla (PATCH) NO borra estas filas: mover el patrón de las 14:00 a las 15:00
 * deja el día cancelado igual de cancelado (RS-BE-31).
 *
 * El UNIQUE (block_id, occurrence_date) es lo que hace idempotente al PUT de
 * la excepción: `on conflict do update`.
 */
export const studentTimeBlockException = pgTable("student_time_block_exception", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  blockId: integer("block_id").notNull().references(() => studentTimeBlock.id, { onDelete: "cascade" }),
  occurrenceDate: date("occurrence_date", { mode: "string" }).notNull(),
  status: timeBlockExceptionStatusEnum("status").notNull(),
  /** NULL en `cancelled`; obligatorias en `moved`, y el CHECK lo exige. */
  startTime: time("start_time"),
  endTime: time("end_time"),
}, (t) => ({
  uqTimeBlockException: unique("uq_time_block_exception").on(t.blockId, t.occurrenceDate),
  chkTimeBlockExcMovido: check(
    "chk_time_block_exc_movido",
    sql`(${t.status} = 'cancelled' AND ${t.startTime} IS NULL AND ${t.endTime} IS NULL) OR (${t.status} = 'moved' AND ${t.startTime} IS NOT NULL AND ${t.endTime} IS NOT NULL AND ${t.endTime} > ${t.startTime})`,
  ),
  chkTimeBlockExcGrilla: check(
    "chk_time_block_exc_grilla",
    sql`${t.startTime} IS NULL OR (${t.startTime} >= '07:00' AND ${t.endTime} <= '22:00')`,
  ),
}));

/**
 * RS-BE-44 · Último resultado del test de especialidad, una fila por alumno.
 *
 * Solo el último (decisión 5 del dueño): rehacer el test reemplaza la fila con
 * `on conflict (student_id) do update`, que vuelve a fijar `completed_at`. No
 * se guardan respuestas, desempates, motivo ni líneas de Ulises. El ranking es
 * `jsonb` porque se lee y se escribe entero y su orden es parte del dato; cada
 * elemento es `{ key, specialtyId, affinity }` y lo valida Zod
 * (`storedRankingSchema`), y el `specialtyId` no lleva FK: es una foto.
 * Migración `drizzle/0014_specialty_test_result.sql`.
 */
export const studentSpecialtyTestResult = pgTable("student_specialty_test_result", {
  studentId: integer("student_id").primaryKey().references(() => student.id, { onDelete: "cascade" }),
  /** `AAAA-MM-DD.N`, la versión del contenido con la que se calculó. */
  contentVersion: varchar("content_version", { length: 20 }).notNull(),
  ranking: jsonb("ranking").notNull(),
  isTie: boolean("is_tie").notNull(),
  completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  chkSpecialtyTestVersion: check(
    "chk_specialty_test_version",
    sql`${t.contentVersion} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\\.[0-9]+$'`,
  ),
  chkSpecialtyTestRanking: check(
    "chk_specialty_test_ranking",
    sql`jsonb_typeof(${t.ranking}) = 'array' and jsonb_array_length(${t.ranking}) = 4`,
  ),
}));
