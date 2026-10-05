---
name: Curriculum
description: Retrieve student curriculum grid, specialties and manage simulated course status
targets:
  - ../../../src/modules/curriculum/**
  - ../../../src/shared/middleware/auth-middleware.ts
---

# Curriculum

## User Stories

| ID | Description |
| --- | --- |
| US03 | Visualizar malla curricular interactiva. |
| US04 | Actualizar/simular estados visuales de cursos. |

## Business Rules

### BR-CU-01: GET /curriculum/me — Student Curriculum Grid
- Retorna la lista de cursos asociados al currículo del estudiante autenticado.
- Filtra usando el `curriculum_id` del estudiante.
- Incluye:
  - `id`: ID numérico del curriculum_course (retornado como string).
  - `code`: Código del curso.
  - `name`: Nombre del curso.
  - `credits`: Créditos asignados.
  - `level`: Ciclo académico.
  - `row`: Posición visual en el grid (`display_order - 1`).
  - `category`: EEGG, COMMON, ELECTIVE o FACULTY.
  - `prerequisites`: Lista de IDs de prerrequisitos (cursos o marcadores de ciclo).
  - `specialties`: Lista de nombres de las especialidades recomendadas.
  - `externalFaculty`: Nombre de la facultad de origen (si aplica).
- Retorna la lista de especialidades únicas de la carrera.
- Retorna las simulaciones registradas para el estudiante.
- **Auth**: Bearer token (vía `authMiddleware`).

### BR-CU-02: PUT /curriculum/me/simulation — Register Course Simulation
- Registra una simulación de estado visual para un curso.
- El body incluye `curriculumCourseId` (number) y `status` (`planned` | `simulated_completed`).
- Inserta o actualiza en la tabla `student_curriculum_simulation` para el estudiante autenticado.
- **Auth**: Bearer token.

### BR-CU-03: DELETE /curriculum/me/simulation/:curriculumCourseId — Remove Course Simulation
- Elimina el estado simulado para un curso, permitiendo que regrese a su estado calculado.
- Remueve el registro en `student_curriculum_simulation` para el estudiante y curso especificados.
- **Auth**: Bearer token.

---

## Endpoints

### GET /curriculum/me

Retorna la malla curricular, lista de especialidades y simulaciones activas.

- **Auth**: Bearer token
- **Response** `200 OK`:
  ```json
  {
    "courses": [
      {
        "id": "1",
        "code": "1001",
        "name": "Introducción a los Sistemas",
        "credits": 4,
        "level": 1,
        "row": 0,
        "category": "FACULTY",
        "prerequisites": [],
        "specialties": [],
        "externalFaculty": null
      }
    ],
    "specialties": ["Ingeniería de Software"],
    "simulation": [
      {
        "curriculumCourseId": "1",
        "status": "planned"
      }
    ]
  }
  ```

### PUT /curriculum/me/simulation

Registra o actualiza el estado simulado de un curso.

- **Auth**: Bearer token
- **Request body**:
  ```json
  {
    "curriculumCourseId": 1,
    "status": "planned"
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "message": "Simulation updated",
    "simulation": {
      "curriculumCourseId": "1",
      "status": "planned"
    }
  }
  ```

### DELETE /curriculum/me/simulation/:curriculumCourseId

Elimina la simulación para un curso.

- **Auth**: Bearer token
- **Response** `200 OK`:
  ```json
  {
    "message": "Simulation removed"
  }
  ```

---

## Schemas (Zod)

### `updateSimulationSchema`

```typescript
export const updateSimulationSchema = z.object({
  curriculumCourseId: z.number().int().positive(),
  status: z.enum(["planned", "simulated_completed"]),
});
```
