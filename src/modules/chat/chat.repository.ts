import { sql } from "drizzle-orm";
import type { db } from "../../db/index.js";
import { buildParticipant, studentRoleFromPosition } from "./chat.logic.js";
import type { ChatParticipant } from "./chat.types.js";

type StudentChatRow = {
  user_id: number;
  full_name: string;
  position: "delegate" | "subdelegate" | null;
};

type TeacherChatRow = {
  user_id: number;
  full_name: string;
  section_role: "teacher" | "jp";
};

export class ChatRepository {
  constructor(readonly database: typeof db) {}

  async findStudentParticipant(
    studentId: number,
    sectionId: number,
  ): Promise<ChatParticipant | null> {
    const rows = (await this.database.execute(sql`
      select
        au.id as user_id,
        au.full_name,
        sr.position
      from enrollment e
      join student st on st.id = e.student_id
      join app_user au on au.id = st.user_id
      left join section_representative sr
        on sr.enrollment_id = e.id
       and sr.section_id = e.section_id
       and sr.is_active = true
      where e.student_id = ${studentId}
        and e.section_id = ${sectionId}
        and e.status = 'active'
      order by case sr.position when 'delegate' then 0 when 'subdelegate' then 1 else 2 end
      limit 1
    `)) as unknown as StudentChatRow[];

    const row = rows[0];
    if (!row) return null;

    const role = studentRoleFromPosition(row.position);
    return buildParticipant(row, sectionId, role);
  }

  async findTeacherParticipant(
    teacherId: number,
    sectionId: number,
  ): Promise<ChatParticipant | null> {
    const rows = (await this.database.execute(sql`
      select
        au.id as user_id,
        au.full_name,
        case
          when sec.teacher_id = t.id then 'teacher'
          when sec.jp_id = t.id then 'jp'
        end as section_role
      from section sec
      join teacher t on t.id = ${teacherId}
      join app_user au on au.id = t.user_id
      where sec.id = ${sectionId}
        and (sec.teacher_id = ${teacherId} or sec.jp_id = ${teacherId})
      limit 1
    `)) as unknown as TeacherChatRow[];

    const row = rows[0];
    if (!row?.section_role) return null;

    return buildParticipant(row, sectionId, row.section_role);
  }
}

