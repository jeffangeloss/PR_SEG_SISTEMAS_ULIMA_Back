export type ChatParticipantRole =
  | "student"
  | "delegate"
  | "subdelegate"
  | "teacher"
  | "jp";

export type ChatParticipant = {
  uid: string;
  userId: number;
  sectionId: number;
  displayName: string;
  role: ChatParticipantRole;
  roleLabel: string;
  isModerator: boolean;
  weight: number;
};

