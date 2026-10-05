export type RepresentativePosition = "delegate" | "subdelegate";

export type SectionRepresentativeRow = {
  id: number;
  enrollment_id: number;
  position: RepresentativePosition;
  section_id: number;
  section_code: string;
  course_id: number;
  course_name: string;
  enrolled_students: number | string;
};

export type SectionRepresentativeResponse = {
  id: string;
  enrollmentId: string;
  idSeccion: string;
  codigoSeccion: string;
  idCurso: string;
  nombreCurso: string;
  role: "delegado" | "subdelegado";
  alumnosMatriculados: number;
};

export type RepresentativesResult = {
  sectionRepresentatives: SectionRepresentativeResponse[];
};

export type RepresentativeAccess = {
  id: number;
  sectionId: number;
  studentId: number;
  position: RepresentativePosition;
};

export type AnnouncementRow = {
  id: number;
  section_id: number;
  section_representative_id: number;
  title: string;
  message: string;
  published_at: Date | string | null;
  autor_code: string;
  full_name: string;
  institutional_email: string;
  position: RepresentativePosition;
};

export type AnnouncementOwnership = {
  id: number;
  sectionRepresentativeId: number;
  sectionId: number;
  studentId: number;
  isActive: boolean;
};

export type AnnouncementAuthorResponse = {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "delegado" | "subdelegado";
  career_id: null;
  currentCycle: string;
  setupComplete: true;
};

export type AnnouncementResponse = {
  id: string;
  idSeccion: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  autorCode: string;
  autor: AnnouncementAuthorResponse;
};

export type AnnouncementsResult = {
  anuncios: AnnouncementResponse[];
};
