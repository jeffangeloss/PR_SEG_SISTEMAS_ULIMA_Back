---
name: Alerts
description: Alertas académicas del estudiante (riesgo académico y alta carga)
targets:
  - ../../../src/modules/alerts/**
  - ../../../src/shared/middleware/auth-middleware.ts
---

# Alerts

App móvil centrada en el estudiante: genera y expone alertas académicas a partir de las notas personales y la carga de evaluaciones. Los cálculos usan **solo el promedio personal** del alumno (no promedios de sección).

## User Stories

| ID | Description |
| --- | --- |
| HU08 | Como alumno quiero recibir alertas de riesgo académico y de alta carga de evaluaciones. |

### BR-ALERT-01: Autorización
- Todo el módulo requiere `Authorization: Bearer <JWT>` (`authMiddleware`) y rol de alumno (`requireRole('student','delegate','subdelegate')`); un token docente recibe `403 FORBIDDEN`.
- El `studentId` sale del contexto del JWT; si falta → `401 STUDENT_NOT_FOUND`.

### BR-ALERT-06: Alertas de inasistencias (`academic_risk`)
- Las alertas creadas por el docente vía `attendance-risk.notify` también tienen tipo `academic_risk`.
- Cuando el estudiante consulta `GET /alerts/me`, estas alertas se augmentan con `courseName` y `sectionCode` igual que las de riesgo académico.
- El título de una alerta de inasistencia sigue el formato `"Alerta de inasistencias - <courseName>"` para permitir la extracción del nombre del curso en `augmentAlerts`.

### BR-ALERT-02: Riesgo académico (`academic_risk`)
- Se evalúa por curso, agregando las evaluaciones **ya calificadas** del alumno.
- `gradedWeight` = suma de los pesos (%) de las evaluaciones con nota registrada; `weightedSum` = suma de `nota * peso`.
- `promedioPersonal = weightedSum / gradedWeight` (0 si no hay avance).
- **Umbral**: se genera alerta si `gradedWeight > 55` **y** `promedioPersonal < 10.5` (avance evaluado mayor al 55% y promedio menor a 10.5). Ambos bordes son estrictos.
  `[@test] ../../../test/alerts.logic.test.ts`
- La lógica de agregación y umbral es pura y vive en `alerts.logic.ts` (`aggregateCourseScores`, `personalAverage`, `isAcademicRisk`).

### BR-ALERT-07: Riesgo crítico (`academic_risk`, título `Riesgo Crítico: <curso>`)
- Detecta a media asignatura (antes de que aplique BR-ALERT-02 por poco avance) a los alumnos que ya casi no pueden aprobar, usando el peso **restante** (evaluaciones aún no publicadas).
- `totalWeight` = suma de los pesos de **todas** las evaluaciones del curso (calificadas o no; cada `assessment_id` cuenta una vez). `requiredOnRemaining = (10.5·totalWeight − weightedSum) / (totalWeight − gradedWeight)` = nota promedio necesaria en lo que falta para llegar a la aprobatoria (`PASSING_GRADE = 10.5`).
- **Umbral**: hay al menos una nota (`gradedWeight > 0`), queda peso por calificar (`totalWeight − gradedWeight > 0`) y `requiredOnRemaining > 15` (`CRITICAL_REQUIRED_ON_REMAINING`). Borde estricto (exactamente 15 NO es crítico).
- **Precedencia**: si un curso es crítico, se emite **solo** la alerta crítica (no también la de BR-ALERT-02) para no duplicar el aviso.
- Reusa el `type` `academic_risk` (no se agrega enum); se distingue por el título `Riesgo Crítico: <curso>`. Deduplicado por título (BR-ALERT-04) y aumentado con curso/sección como las demás.
- Lógica pura en `alerts.logic.ts` (`aggregateCourseScores.totalWeight`, `requiredOnRemaining`, `isCriticalRisk`).
  `[@test] ../../../test/alerts.logic.test.ts`

### BR-ALERT-03: Alta carga (`high_load`)
- Se genera una alerta por cada **semana académica con 3 o más evaluaciones** programadas (`getHighLoadWeeks`, `count(assessment) >= 3` agrupado por `week_number`).

### BR-ALERT-04: Deduplicación
- Antes de crear una alerta se busca una con el mismo título exacto (`findAlertByTitle`): `Riesgo Académico: <curso>` / `Alta Carga: Semana <n>`. Si ya existe, no se duplica.

### BR-ALERT-05: Tipos válidos
- Enum `alert.type`: solo `academic_risk` y `high_load`. (`grade_reminder`/`course_average`/`system` existen en el tipo TS pero no se emiten en v1.)

## Endpoints

### GET /alerts/me
- **Auth**: Bearer (rol alumno).
- Recalcula alertas (idempotente por la deduplicación) y devuelve todas las del alumno.
- **Response** `200`: `{ "alerts": [ { "id", "studentId", "type", "title", "message", "isRead", "createdAt" } ] }`.
- **Errors**: `401 MISSING_TOKEN` / `401 INVALID_TOKEN` / `401 STUDENT_NOT_FOUND` / `403 FORBIDDEN`.

### PUT /alerts/me/:alertId/read
- Marca una alerta del alumno como leída.
- `alertId` inválido (no entero) → `400 INVALID_ALERT_ID`.
- Alerta inexistente o de otro alumno → `404 ALERT_NOT_FOUND`.
- **Response** `200`: `{ "message": "Alerta marcada como leída" }`.

## Arquitectura

- Capas `routes → controller → service → repository` (módulo canónico). El service recibe `AlertsRepository` + `EventBus` y no importa `db`; la lógica de umbrales se extrajo a `alerts.logic.ts` para testeo.
- Recalcular es interno (parte de `GET /alerts/me`); no hay endpoint público de recálculo.

## Test Links

- Umbral de riesgo académico y agregación de notas: `[@test] ../../../test/alerts.logic.test.ts`
