import type { db } from "../../db/index.js";
import { sql } from "drizzle-orm";

// Sin catch de rescate: un fallo de BD (o un estudiante inexistente) se propaga
// en vez de simular malla vacía o un curriculum_id falso. Devolver `1` ante
// error ocultaba mallas rotas como "vacías". Ver docs/AUDITORIA_TECNICA.md §6.1.
export class CurriculumRepository {
  constructor(readonly database: typeof db) {}

  async findStudentCurriculumId(studentId: number): Promise<number> {
    const result = await this.database.execute(sql`
      select curriculum_id
      from student
      where id = ${studentId}
      limit 1
    `) as unknown as Array<{ curriculum_id: number }>;
    if (!result[0]) {
      throw new Error(`Student with ID ${studentId} not found`);
    }
    return Number(result[0].curriculum_id);
  }

  async findCurriculumCourses(curriculumId: number) {
    return await this.database.execute(sql`
      select
        cc.id,
        c.code,
        c.name,
        cc.credit as credits,
        cc.cycle as level,
        cc.display_order - 1 as row,
        case cc.category
          when 'general_studies' then 'EEGG'
          when 'common' then 'COMMON'
          when 'elective' then 'ELECTIVE'
          else 'FACULTY'
        end as category,
        c.origin_faculty as external_faculty,
        coalesce(array_agg(distinct sp.name) filter (where sp.id is not null), '{}') as specialties
      from curriculum_course cc
      join course c on c.id = cc.course_id
      left join curriculum_course_specialty ccs on ccs.curriculum_course_id = cc.id
      left join specialty sp on sp.id = ccs.specialty_id
      where cc.curriculum_id = ${curriculumId}
      group by cc.id, c.code, c.name, cc.credit, cc.cycle, cc.display_order, cc.category, c.origin_faculty
      order by cc.cycle, cc.display_order, c.name
    `) as unknown as Array<any>;
  }

  async findCoursePrerequisites(curriculumId: number) {
    return await this.database.execute(sql`
      select curriculum_course_id, prerequisite_curriculum_course_id, required_cycle
      from course_prerequisite
      where curriculum_id = ${curriculumId}
    `) as unknown as Array<any>;
  }

  async findStudentSimulation(studentId: number) {
    return await this.database.execute(sql`
      select curriculum_course_id as "curriculumCourseId", status
      from student_curriculum_simulation
      where student_id = ${studentId}
    `) as unknown as Array<{ curriculumCourseId: number; status: "planned" | "simulated_completed" | "simulated_available" }>;
  }

  async courseExistsInCurriculum(curriculumId: number, curriculumCourseId: number): Promise<boolean> {
    const result = await this.database.execute(sql`
      select 1 from curriculum_course
      where id = ${curriculumCourseId} and curriculum_id = ${curriculumId}
      limit 1
    `) as unknown as Array<any>;
    return result.length > 0;
  }

  async upsertSimulation(studentId: number, curriculumId: number, curriculumCourseId: number, status: "planned" | "simulated_completed" | "simulated_available") {
    await this.database.execute(sql`
      insert into student_curriculum_simulation (student_id, curriculum_id, curriculum_course_id, status)
      values (${studentId}, ${curriculumId}, ${curriculumCourseId}, ${status})
      on conflict (student_id, curriculum_course_id)
      do update set status = excluded.status
    `);
  }

  async deleteSimulation(studentId: number, curriculumCourseId: number) {
    await this.database.execute(sql`
      delete from student_curriculum_simulation
      where student_id = ${studentId} and curriculum_course_id = ${curriculumCourseId}
    `);
  }
}
