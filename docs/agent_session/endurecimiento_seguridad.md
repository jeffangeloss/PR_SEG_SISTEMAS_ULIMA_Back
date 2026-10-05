# Endurecimiento de Seguridad — Backend (Release 1)

Sesión de correcciones de seguridad derivadas del análisis de deuda técnica del proyecto. Todos los cambios siguen el flujo Spec-Driven (Tessl): cada corrección actualiza su spec.

**Branch:** `jeff` (integrado con `origin/main`, sin conflictos). **Verificación:** `npx tsc --noEmit` → exit 0.

---

## Contexto

El diagnóstico priorizó varias vulnerabilidades en el módulo de autenticación/autorización y en la configuración. Esta sesión corrige las de **alto impacto y bajo esfuerzo**.

---

## Cambios realizados

### 1. Autenticación exclusivamente por JWT — `src/shared/middleware/auth-middleware.ts`
- **Antes:** el middleware aceptaba `?code=` (query), header `X-User-Code` y el prefijo `Bearer dev-<código>` como vías de autenticación, **sin validar contraseña ni JWT**, activas en todos los entornos. Permitían suplantar a cualquier alumno con solo su código. Además, ante un error de BD seteaba `userId = 0` (fail-open).
- **Después:** se autentica **solo** con `Authorization: Bearer <JWT>`, validando firma y `tokenVersion` (Single Active Session). Sin token → `401 MISSING_TOKEN`; inválido/expirado/revocado → `401 INVALID_TOKEN`.
- **Spec:** `auth.spec.md` → **BR-AUTH-08**.

### 2. Fallo seguro ante errores de BD — `src/modules/auth/auth.service.ts`
- **Antes:** `loginWithGoogle()` y `me()` devolvían un usuario sintético (`id=0`, `code="00000000"`) **con JWT firmado** si la BD fallaba.
- **Después:** ambos `catch` lanzan `HttpError(500, "Error interno del servidor.", "INTERNAL_ERROR")`. Nunca se emite un token en una ruta de error.
- **Spec:** `auth.spec.md` → **BR-AUTH-09**.

### 3. Protección de rutas expuestas (C3) — `course-detail`, `grades`, `section-management`
- **Antes:** `course-detail` (7 rutas), `grades` (`/me/courses`) y `section-management` (`/representatives`) exponían datos académicos (secciones, docentes, matrículas con códigos de alumno, notas, representantes) **sin `authMiddleware`** → enumerables sin autenticación.
- **Después:** `app.use("*", authMiddleware)` en los tres módulos (mismo patrón que `curriculum`). En `course-detail`, la sub-petición interna de `/sections/:sectionId` **reenvía el header `Authorization`** para pasar el middleware.
- **No-regresión:** el frontend ya envía el JWT en toda petición (el `ApiClient` de `main` lo adjunta automáticamente), por lo que los endpoints siguen funcionando.
- **Specs:** `course-detail.spec.md`, `grades.spec.md`, `section-management.spec.md` (antes vacías) ahora fijan el requisito de Bearer; `docs/specs/api-contracts.md` aclara el *enforced* e incluye `/auth/google` como pública.

### 4. CORS configurable — `src/server.ts`, `src/config/env.ts`, `src/config/app-config.ts`
- **Antes:** `app.use("*", cors())` → `Access-Control-Allow-Origin: *` sin restricción.
- **Después:** lee `CORS_ORIGINS` (lista separada por comas) vía `config.server.corsOrigins`; limita métodos a `GET/POST/PUT/DELETE/OPTIONS` y headers a `Content-Type/Authorization`. Si la lista está vacía mantiene `*` para no romper desarrollo.
- **Spec:** `platform-runtime.spec.md` → **BR-PLATFORM-08**. **Acción pendiente:** definir `CORS_ORIGINS` en producción.

### 5. Gestor de paquetes canónico — `.gitignore` (+ `package-lock.json` des-trackeado)
- `vercel.json` usa `bun install`/`bun run build` → **Bun** es canónico; `bun.lock` es el lockfile versionado.
- Se dejó de versionar `package-lock.json` y se agregó a `.gitignore`. (Sobrevivió al merge con `main`, que agregó la dependencia `pg`.)
- **Spec:** `platform-runtime.spec.md` → **BR-PLATFORM-09**.

### 6. Saneo de `.env.example`
- Se reemplazó el host real de la instancia de RDS por placeholders genéricos (`USER:PASSWORD@DB_HOST`) y se documentaron `JWT_EXPIRES_IN` y `CORS_ORIGINS`, para no exponer la topología de infraestructura en el repo.

---

## Verificación

- `npx tsc --noEmit` → **exit 0** (incluido tras integrar `origin/main`).
- `.env` ignorado; **ningún secreto trackeado** en los commits.
- `bun run build` no se pudo correr aquí (bun no instalado localmente); validado por typecheck con `tsc`.

---

## Deuda pendiente (relacionada)

- **Autorización fina:** los endpoints recién protegidos exigen JWT pero aún **no** validan que cada alumno solo acceda a *sus* datos (queda anotado en las specs).
- **C4:** SQL directo en los `routes` de `course-detail`/`grades`/`section-management` (refactor a repository/service).
- **Tests:** no hay tests automatizados en el backend.
- **`/grades/me/courses`:** derivar el alumno desde el JWT (`studentId`) en vez del `?code=` del cliente.
