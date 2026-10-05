export type AppRole = "student" | "delegate" | "subdelegate";

export type SelectionType = "primary" | "interest";

export type ActiveSpecialty = {
  specialtyId: number;
  name: string;
  selectionType: SelectionType;
};

export type ProfileResponse = {
  id: number;
  studentId: number;
  code: string;
  fullName: string;
  institutionalEmail: string;
  role: AppRole;
  currentLevel: number | null;
  setupComplete: boolean;
  career: {
    id: number;
    code: string;
    name: string;
    faculty: string;
  };
  curriculum: {
    id: number;
    name: string;
  };
  specialties: ActiveSpecialty[];
};

export type ProfileBase = Omit<ProfileResponse, "role" | "specialties">;

export type CareerResponse = {
  id: number;
  code: string;
  name: string;
  faculty: string;
  is_active: true;
  display_order: number;
};

export type SpecialtyResponse = {
  id: number;
  careerId: number;
  carrera_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
};

export type UpdateSpecialtiesRequest = {
  primarySpecialtyId?: number | null;
  interestSpecialtyIds?: number[];
};

export type UpdateSpecialtiesResult = {
  message: "Specialties updated";
  setupComplete: true;
  specialties: Array<{
    specialtyId: number;
    selectionType: SelectionType;
  }>;
};
