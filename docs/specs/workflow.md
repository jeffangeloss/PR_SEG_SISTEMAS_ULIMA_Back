# Flujo Backend De Specs

Este repo tiene su propia instalacion de Tessl. Las specs backend viven en:

```text
specs/features/<feature>/<feature>.spec.md
```

## Orden De Trabajo

1. Leer `.tessl/RULES.md`, `AGENTS.md`, `KNOWLEDGE.md`, `README.md` y `docs/specs/feature-index.md`.
2. Ubicar la historia de usuario real y la prioridad de la feature.
3. Abrir o crear la spec backend correspondiente.
4. Definir contrato REST, reglas de negocio, autorizacion, validaciones y persistencia.
5. Actualizar `docs/specs/api-contracts.md` si cambia un endpoint, payload, respuesta, error o autorizacion.
6. Esperar aprobacion explicita de la spec.
7. Implementar solo en los archivos cubiertos por `targets`.
8. Ejecutar `bun run build` si hubo cambios TypeScript.
9. Enlazar tests existentes con `[@test]` junto al requisito que verifican.

## Contexto De Datos

- PostgreSQL definitivo ya existe y esta modelado en `src/db/schema/schema.ts`.
- No crear tablas, migraciones, seeds ni inserts mock sin aprobacion explicita.
- No cargar JSON del frontend a PostgreSQL.
- Si faltan datos, reportar el faltante en vez de usar mocks.
- `src/events` esta listo como infraestructura vacia; observers reales requieren spec y targets.

## Arquitectura Esperada

- Cada modulo backend sigue `routes -> controller -> service -> repository`.
- Los DTOs de entrada se validan con Zod en `*.schemas.ts`; los DTOs de respuesta se definen en `*.types.ts` cuando aplica.
- Los services contienen reglas de negocio y reciben repositories/EventBus por constructor.
- Los repositories encapsulan Drizzle y no deben contener reglas de negocio.
- Los observers en `src/events` solo ejecutan efectos secundarios de dominio.
- Si una feature requiere cambios en `src/shared` o `src/events`, esos paths deben estar incluidos en los `targets` de la spec.
- Si una feature requiere cambio de base de datos, incluir `src/db/schema/schema.ts` y obtener aprobacion explicita de BD.

## Orden Para Reescribir Specs

1. Auth: US01, US02.
2. Academic Profile: US05.
3. Curriculum: US03, US04.
4. Grades: US06, US07.
5. Schedule: US09.
6. Course Detail: US13, US14, US17.
7. Alerts: US15.
8. Section Management: US16, US17, US18.

## Relacion Con Frontend

El backend debe definir primero su contrato local en `docs/specs/api-contracts.md` cuando la feature requiere API, permisos, reglas de negocio o base de datos. Luego el frontend debe reflejar el mismo contrato en su propio repo.

Si el frontend propone una feature visual que despues necesita API, se debe volver a esta spec backend antes de implementar el contrato.
