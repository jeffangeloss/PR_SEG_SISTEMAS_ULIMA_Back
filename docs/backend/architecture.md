# Arquitectura — Correcciones de Code Smells

## Contexto

Se auditaron los módulos **Grades** (Calculadora de Notas) y **Attendance Risk**
(Alumnos Impedidos/En Riesgo) en frontend y backend para garantizar que la
lógica de negocio resida **únicamente en el backend**.

## Problemas Encontrados y Correcciones

### 1. Módulo Grades (Backend) — Lógica inline en rutas

**Problema**: `grades.routes.ts` contenía SQL, transformación de datos y
formateo de respuesta directamente en el manejador de la ruta. Controller,
Service y Repository estaban vacíos (scaffolds sin implementación).

**Corrección**: Se aplicó la arquitectura por capas:

| Capa | Responsabilidad |
|------|----------------|
| `grades.repository.ts` | Consultas SQL a PostgreSQL |
| `grades.service.ts` | Orquestación, transformación de datos |
| `grades.controller.ts` | Manejo HTTP (request/response) |
| `grades.routes.ts` | Solo enrutamiento con delegación al controller |

### 2. Módulo Grades (Backend) — Nuevo endpoint `POST /grades/me/calculate`

**Problema**: La lógica de cálculo de promedio ponderado (`calcularPromedioPonderado`,
`sumaDePesos`) estaba en el frontend (`notas_calculo.dart`), violando el principio
de que la lógica de negocio debe estar en el backend.

**Corrección**:
- Se creó `grades.logic.ts` con funciones puras de cálculo (testeable con `bun test`)
- Se agregó `POST /grades/me/calculate` que recibe `{ notas: [{ valor, peso }] }`
  y devuelve `{ promedio, sumaPesos }`
- El frontend ahora llama al endpoint en vez de calcular localmente
- Se eliminó `notas_calculo.dart` del frontend

### 3. Módulo Grades (Backend) — Dead code

**Problema**: `grades.schemas.ts` definía `upsertStudentScoreSchema` para un
endpoint (`PUT /grades/me/scores`) que nunca se implementó (marcado como NO
IMPLEMENTADO en la spec).

**Corrección**: Se eliminó el schema muerto y se reemplazó con
`calculateAverageSchema`.

### 4. Módulo Attendance Risk (Backend) — Lógica duplicada

**Problema**: En `attendance-risk.service.ts`, la función `computeSummary()` se
usaba en `getAttendanceRisk` pero el mismo bucle estaba escrito inline en
`getAttendanceRiskSummary`.

**Corrección**: `getAttendanceRiskSummary` ahora reutiliza `classifyStudent()`
y `computeSummary()`.

### 5. Módulo Attendance Risk (Frontend) — Mock fallback

**Problema**: `attendance_risk_service.dart` tenía un método `_mockStudents()`
que retornaba datos falsos cuando la API fallaba. El proyecto prohíbe
explícitamente mock como fallback ("No usar mocks como fallback").

**Corrección**: Se eliminó `_mockStudents()`. Los errores de API se propagan
para que el controller muestre un estado de error real.

### 6. NotasService eliminado — Persistencia en backend

**Problema**: `notas_service.dart` guardaba notas personales en
`shared_preferences` como JSON string, abusando del almacenamiento key-value
y duplicando la gestión de identidad del estudiante.

**Corrección**: Se eliminó `notas_service.dart`. Las notas ahora se persisten
en `student_score` vía `POST /grades/me/notes` y se recuperan con
`GET /grades/me/notes`.

### 7. Servicios Frontend — Singletons vs DI

**Problema**: `evaluations_service.dart` usaba el patrón singleton con
`_internal` constructor y `fetchJsonOverride` para testeo.

**Corrección**: Se agregó constructor opcional con `ApiClient` inyectable y
`setTestInstance()` para reemplazar el singleton en tests. Se eliminó
`fetchJsonOverride`. Los tests usan `_FakeApiClient`.

## Archivos Modificados

### Backend
- `src/modules/grades/grades.logic.ts` — **NUEVO**: funciones puras de cálculo
- `src/modules/grades/grades.repository.ts` — Agregado `findCoursesAndAssessments()`
- `src/modules/grades/grades.service.ts` — Agregados `getCoursesAndSyllabi()` y `calculateAverage()`
- `src/modules/grades/grades.controller.ts` — Agregados `getMeCourses()` y `calculateAverage()`
- `src/modules/grades/grades.routes.ts` — Solo enrutamiento (SQL/logica removidos)
- `src/modules/grades/grades.schemas.ts` — Eliminado dead code, agregado `calculateAverageSchema`
- `src/modules/grades/grades.types.ts` — Agregados `NotaInput`, `CalculateAverageResponse`
- `src/modules/grades/index.ts` — Re-exporta nuevos tipos/schemas
- `src/modules/attendance-risk/attendance-risk.service.ts` — Refactor `getAttendanceRiskSummary`
- `docs/specs/api-contracts.md` — Documentado `POST /grades/me/calculate`
- `specs/features/grades/grades.spec.md` — Actualizado con BR-GRADES-04

### Frontend
- `lib/domain/notas/notas_calculo.dart` — **ELIMINADO**
- `test/domain/notas_calculo_test.dart` — **ELIMINADO** (migrado a backend)
- `lib/services/notas_service.dart` — **ELIMINADO** (reemplazado por API REST)
- `lib/pages/calculadora/calculadora_controller.dart` — Llamadas a API en vez de cálculo local y `NotasService`
- `lib/pages/calculadora/calculadora_page.dart` — Adaptado a async
- `lib/services/attendance_risk_service.dart` — Eliminado `_mockStudents()`
- `lib/services/evaluations_service.dart` — DI en vez de singleton, `fetchJsonOverride` eliminado
- `test/services/user_cache_reset_test.dart` — Usa `_FakeApiClient` en vez de `fetchJsonOverride`
- `specs/features/grades/grades.spec.md` — Actualizado
