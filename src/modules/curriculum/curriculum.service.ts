import type { EventBus } from "../../events/index.js";
import type { CurriculumRepository } from "./curriculum.repository.js";
import { HttpError } from "../../shared/errors/http-error.js";

export class CurriculumService {
  constructor(
    readonly repository: CurriculumRepository,
    readonly events: EventBus,
  ) {}

  async getCurriculum(studentId: number) {
    const curriculumId = await this.repository.findStudentCurriculumId(studentId);
    const courses = await this.repository.findCurriculumCourses(curriculumId);
    const prerequisites = await this.repository.findCoursePrerequisites(curriculumId);
    const simulation = await this.repository.findStudentSimulation(studentId);

    const byCourse = new Map<number, string[]>();
    for (const prerequisite of prerequisites) {
      const list = byCourse.get(Number(prerequisite.curriculum_course_id)) ?? [];
      if (prerequisite.prerequisite_curriculum_course_id != null) {
        list.push(String(prerequisite.prerequisite_curriculum_course_id));
      } else if (Number(prerequisite.required_cycle) === 5) {
        list.push("_V_CICLO_");
      } else if (Number(prerequisite.required_cycle) === 6) {
        list.push("_VI_CICLO_");
      }
      byCourse.set(Number(prerequisite.curriculum_course_id), list);
    }

    const mappedCourses = courses.map((course) => ({
      id: String(course.id),
      code: course.code,
      name: course.name,
      credits: Number(course.credits),
      level: Number(course.level),
      row: Number(course.row),
      category: course.category,
      prerequisites: byCourse.get(Number(course.id)) ?? [],
      specialties: course.specialties ?? [],
      externalFaculty: course.external_faculty,
    }));

    return {
      courses: mappedCourses,
      specialties: [...new Set(mappedCourses.flatMap((course) => course.specialties))].filter(Boolean),
      simulation: simulation.map((sim) => ({
        curriculumCourseId: String(sim.curriculumCourseId),
        status: sim.status,
      })),
    };
  }

  async updateSimulation(studentId: number, curriculumCourseId: number, status: "planned" | "simulated_completed" | "simulated_available") {
    const curriculumId = await this.repository.findStudentCurriculumId(studentId);
    const courseExists = await this.repository.courseExistsInCurriculum(curriculumId, curriculumCourseId);
    if (!courseExists) {
      throw new HttpError(404, "Curso no encontrado en el currículo del estudiante.", "COURSE_NOT_FOUND");
    }

    await this.repository.upsertSimulation(studentId, curriculumId, curriculumCourseId, status);

    return {
      message: "Simulation updated",
      simulation: {
        curriculumCourseId: String(curriculumCourseId),
        status,
      },
    };
  }

  async deleteSimulation(studentId: number, curriculumCourseId: number) {
    const curriculumId = await this.repository.findStudentCurriculumId(studentId);
    const courseExists = await this.repository.courseExistsInCurriculum(curriculumId, curriculumCourseId);
    if (!courseExists) {
      throw new HttpError(404, "Curso no encontrado en el currículo del estudiante.", "COURSE_NOT_FOUND");
    }

    await this.repository.deleteSimulation(studentId, curriculumCourseId);

    return {
      message: "Simulation removed",
    };
  }
}
