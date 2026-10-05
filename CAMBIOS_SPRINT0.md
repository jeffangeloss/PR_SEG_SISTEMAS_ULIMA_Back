# Reporte de Cambios — Endurecimiento de Seguridad (Sprint 0 + C3)

**Proyecto:** ULimaPlus — `ULima_Backend_IS2` (TS · Hono · Drizzle) + `ULima_Frontend_IS2` (Flutter · Dart)
**Branch:** `jeff` (ambos repos) → integrado con `origin/main` → **pusheado**, listo para PR.
**Fecha:** 2026-06-15
**Origen:** correcciones priorizadas de [DEUDA_TECNICA.md](DEUDA_TECNICA.md).
**Flujo:** Spec-Driven Development (Tessl) — cada cambio actualiza su spec.
**Repos canónicos (movidos):** `github.com/meltiruiz/ULima_Backend_IS2` y `github.com/meltiruiz/ULima_Frontend_IS2`.

---

## Resumen

| # | Hallazgo | Sev. | Repo | Estado |
|---|----------|:----:|------|:------:|
| C1 | Bypass de auth `Bearer dev-` / `?code=` / `X-User-Code` | 🔴 | Backend | ✅ |
| C2 | Auth "fail-open" con usuario mock ante error de BD | 🔴 | Backend | ✅ |
| C3 | **Rutas expuestas sin `authMiddleware`** | 🔴 | Backend + Frontend | ✅ |
| — | CORS abierto (`cors()`) | 🟠 | Backend | ✅ |
| C7 | Doble lockfile | 🔴 | Backend | ✅ |
| C8 | APK release firmado con llaves de debug | 🔴 | Frontend | ✅ |
| — | `.env.example` exponía host real de RDS | 🟡 | Backend | ✅ |

---

## C3 · Protección de rutas expuestas (lo nuevo de esta iteración)

**Problema:** `course-detail` (7 rutas), `grades` (`/me/courses`) y `section-management` (`/representatives`) exponían datos académicos (secciones, docentes, matrículas con códigos de alumno, notas, representantes) **sin autenticación**.

**Backend** — `app.use("*", authMiddleware)` en los 3 módulos (mismo patrón que `curriculum`):
- `src/modules/course-detail/course-detail.routes.ts` — además, la sub-petición interna de `/sections/:sectionId` ahora **reenvía el header `Authorization`** para pasar el middleware.
- `src/modules/grades/grades.routes.ts`
- `src/modules/section-management/section-management.routes.ts`

**Verificación de no-regresión:** los servicios del frontend llamaban estos endpoints **sin token**. Por eso C3 era un cambio coordinado. Al integrar `origin/main` se confirmó que **`main` ya centraliza el token** en `api_client.dart` (adjunta el JWT guardado a toda petición), de modo que el frontend ya envía el `Authorization` automáticamente → los endpoints recién protegidos siguen funcionando.

**Decisión sobre el frontend:** mi cambio inicial en `api_client.dart` (inyección central del token) resultó **redundante** — `origin/main` ya lo tenía (y además con manejo de 401/logout global). Se **descartó** mi versión para no duplicar ni perder el interceptor de 401 de `main`. Del frontend solo se conservó lo genuinamente nuevo: **C8 (firma Android)** + su spec.

**Specs (Tessl):**
- `course-detail.spec.md`, `grades.spec.md`, `section-management.spec.md` (antes **vacías**) ahora fijan el requisito de Bearer JWT (`BR-*-01`).
- `docs/specs/api-contracts.md`: aclara que el Bearer está *enforced* e incluye `/auth/google` como ruta pública.

---

## Resto de cambios (Sprint 0)

- **C1** `auth-middleware.ts`: solo JWT Bearer; eliminado `?code=` / `X-User-Code` / `Bearer dev-`.
- **C2** `auth.service.ts`: `loginWithGoogle()` y `me()` lanzan `HttpError(500)` ante error de BD (sin usuario mock).
- **CORS** `server.ts` + config: restringible vía `CORS_ORIGINS` (default permisivo para no romper dev).
- **C7** lockfile: `package-lock.json` des-trackeado + gitignored (Bun canónico). Sobrevivió al merge con `main` (que agregó `pg`).
- **C8** `android/app/build.gradle.kts`: firma con `key.properties` + fallback a debug; + `key.properties.example` y `.gitignore`.
- **`.env.example`** saneado (host real de RDS → placeholders).

---

## Integración a `main` y verificación

Estrategia elegida: **actualizar `jeff` desde `origin/main` + PR** (flujo del equipo).

| Paso | Backend | Frontend |
|---|---|---|
| Commits en `jeff` (español, lógicos) | 5 | 2 |
| `git merge origin/main` | sin conflictos (auto-merge de `course-detail.routes.ts` conservó auth + cambios de main) | sin conflictos |
| `npx tsc --noEmit` | ✅ exit 0 | — |
| `flutter analyze` | — | ✅ 0 errores (1 issue menor) |
| Secretos trackeados | ninguno ✅ | ninguno ✅ |
| `git push origin jeff` | ✅ `b01100f..331a776` | ✅ `7997ac5..8bdbe80` |

> `jeff` estaba 4 commits (backend) / 15 (frontend) **detrás** de `origin/main`. El merge integró todo ese trabajo del equipo y dejó nuestras correcciones encima, sin conflictos.

### Abrir los Pull Requests (gh no está instalado → hacerlo desde el navegador)
- **Backend:** https://github.com/meltiruiz/ULima_Backend_IS2/compare/main...jeff?expand=1
- **Frontend:** https://github.com/meltiruiz/ULima_Frontend_IS2/compare/main...jeff?expand=1

---

## Acciones manuales pendientes

1. **Abrir los 2 PRs** (links de arriba) y pasar la revisión del equipo.
2. **Generar keystore** (`keytool`) y crear `android/key.properties` para firmar release real (ver `key.properties.example`).
3. **Definir `CORS_ORIGINS`** en producción (Vercel).
4. **Confirmar** `flutter build apk --release` y `bun run build` en una máquina con esas toolchains (aquí bun no está instalado y Gradle no corre en el sandbox).

---

## Deuda crítica que queda PENDIENTE (ver [DEUDA_TECNICA.md](DEUDA_TECNICA.md))

- **C4** — SQL directo en `routes` (refactor a repository/service): esfuerzo grande.
- **C5 / C6** — Cero tests en backend (frontend ya tiene `test/services/api_client_test.dart` en main; ampliar cobertura).
- **C9** — Campos `late` que pueden crashear (frontend): inicialización segura.
- **Autorización fina** — los endpoints recién protegidos exigen JWT pero aún no validan que cada alumno solo vea *sus* datos (queda como deuda explícita en las specs).
