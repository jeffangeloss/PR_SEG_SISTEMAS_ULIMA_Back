---
name: Section Management
description: Consulta de representantes y gestión de anuncios por sección
targets:
  - ../../../src/modules/section-management/**
  - ../../../src/shared/middleware/auth-middleware.ts
---

# Section Management

## Scope

Endpoints relacionados a la gestión/lectura de representantes de sección y a la gestión de anuncios publicados por delegados/subdelegados. Payloads en `docs/specs/api-contracts.md`; esta spec fija la **autorización**.

Esta spec recupera el alcance original de representantes y lo complementa con:

- **HU10 - Registrar anuncios**: implementada.
- **HU11 - Visualizar estadísticas del curso**: pendiente; permanece mockeada en frontend hasta una implementación propia.

## Design / Architecture

- Se sigue la arquitectura del backend: `routes -> controller -> service -> repository -> db`.
- Se aplica **Repository Pattern** para encapsular consultas a `announcement`, `section_representative`, `enrollment`, `student` y `app_user`.
- Se aplica **Service Layer** para reglas de negocio: autorización por sección, ownership de anuncios y soft delete.
- Se usa validación DTO con **Zod** en `section-management.schemas.ts`.
- No se agregan observers/eventos reales en `src/events` porque la spec no define efectos secundarios.

## Business Rules

### BR-SECTION-MGMT-01: Autenticación y rol
- Todas las rutas de `section-management` requieren `Authorization: Bearer <JWT>` (`authMiddleware`) y rol de alumno (`requireRole('student','delegate','subdelegate')`); un token docente recibe `403 FORBIDDEN`.
- Si falta el token -> `401 MISSING_TOKEN`; si es inválido/expirado/revocado -> `401 INVALID_TOKEN`.
- Las rutas de gestión de anuncios requieren además rol técnico `delegate` o `subdelegate`; un alumno regular recibe `403 FORBIDDEN`.

### BR-SECTION-MGMT-02: Representantes activos
- `GET /section-management/representatives` retorna solo las secciones donde el alumno autenticado tiene un `section_representative` activo como delegado/subdelegado.
- La respuesta incluye `idSeccion`, `codigoSeccion`, `idCurso`, `nombreCurso`, `role` y `alumnosMatriculados`, para que el frontend no use valores mock como `MOCK-001` o `Curso asignado`.

### BR-SECTION-MGMT-03: Alcance real vs pendiente
- **Implementado**: `GET /section-management/representatives`.
- **HU10 - Registrar anuncios**: implementada. Los delegados/subdelegados pueden listar, crear, editar y eliminar anuncios de su sección.
- **HU11 - Visualizar estadísticas del curso**: pendiente/no implementada. Las estadísticas/progreso de sección permanecen mockeadas en frontend y no se agrega endpoint real de métricas en esta implementación.

### BR-SECTION-MGMT-04: HU10 - Registrar anuncios
- `GET /section-management/sections/:sectionId/announcements` lista anuncios activos de la sección ordenados por `published_at DESC`.
- `POST /section-management/sections/:sectionId/announcements` inserta en `announcement` con el `section_representative_id` del alumno autenticado, derivado desde `section_representative`; el frontend nunca envía ese id.
- `PUT /section-management/announcements/:id` permite editar `title` y `message` solo al alumno que publicó el anuncio.
- `DELETE /section-management/announcements/:id` realiza soft delete (`is_active = false`) solo al alumno que publicó el anuncio.
- Si el alumno no es delegado/subdelegado activo de la sección -> `403 SECTION_FORBIDDEN`.
- Si intenta editar/eliminar un anuncio ajeno -> `403 ANNOUNCEMENT_FORBIDDEN`.
- Si el anuncio no existe o ya está inactivo -> `404 ANNOUNCEMENT_NOT_FOUND`.
- Los anuncios creados se muestran al alumnado desde `GET /course-detail/sections/:sectionId/announcements`, que lee `announcement` y ordena del más reciente al más antiguo.

### BR-SECTION-MGMT-05: HU11 - Visualizar estadísticas del curso
- `GET /section-management/sections/:sectionId/statistics` devuelve las estadísticas REALES del salón, calculadas desde las notas oficiales (`student_score`): `{ promedioGeneral, porcentajeAprobados, rango0_10, rango11_13, rango14_16, rango17_20 }`.
- **Cálculo** (lógica pura en `section-statistics.logic.ts`): por alumno, promedio ponderado sobre lo YA calificado (Σ nota·peso / Σ peso). Sobre esos promedios: media (`promedioGeneral`), % con promedio ≥ 10.5 (`porcentajeAprobados`) e histograma por rango de la nota **redondeada** (0-10, 11-13, 14-16, 17-20). Solo cuentan los alumnos con al menos una nota; si nadie tiene notas, todo es 0.
  `[@test] ../../../test/section-statistics.logic.test.ts`
- Restringido al **delegado/subdelegado activo** de la sección (`requireRepresentative`); no expone notas individuales, solo agregados.

## Endpoints

Bajo `Authorization: Bearer <token>` (rol alumno):

- `GET /section-management/representatives`
- `GET /section-management/sections/:sectionId/announcements`
- `POST /section-management/sections/:sectionId/announcements`
- `PUT /section-management/announcements/:id`
- `DELETE /section-management/announcements/:id`
- `GET /section-management/sections/:sectionId/statistics` (HU11 — solo delegado/subdelegado)

## Test Links

*(No hay tests automatizados enlazados aún.)*
