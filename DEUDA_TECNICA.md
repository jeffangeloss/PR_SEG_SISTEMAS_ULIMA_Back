# Informe de Deuda Técnica — ULimaPlus (Release 1)

**Proyecto:** ULima_Backend_IS2 (TypeScript · Hono · Drizzle ORM) + ULima_Frontend_IS2 (Flutter · Dart)
**Branch analizada:** `jeff` (ambos repos, sincronizados con `origin`)
**Fecha:** 2026-06-15
**Método:** Auditoría multi-agente sobre 10 dimensiones (arquitectura, calidad, seguridad, dependencias/build, testing × backend y frontend), con verificación adversarial de cada hallazgo crítico/alto contra el código real.

---

## 1. Resumen ejecutivo

Se confirmaron **128 ítems de deuda técnica** tras verificación:

| Severidad | Total | Backend | Frontend |
|-----------|:-----:|:-------:|:--------:|
| 🔴 Crítica | 11 | 8 | 3 |
| 🟠 Alta | 20 | 9 | 11 |
| 🟡 Media | 75 | ~37 | ~38 |
| ⚪ Baja | 22 | ~14 | ~8 |
| **Total** | **128** | **61** | **67** |

**Los 5 riesgos que hay que atacar primero (alto impacto, bajo esfuerzo):**

1. 🔴 **Bypass de autenticación `Bearer dev-`** — cualquiera que conozca un código de alumno puede suplantarlo sin contraseña ni JWT. *(esfuerzo: pequeño)*
2. 🔴 **Autenticación "fail-open"** — ante un error de BD, el servicio devuelve un usuario falso (`id=0`) con un JWT válido. *(pequeño)*
3. 🔴 **Rutas sin autorización** — endpoints de notas, secciones, matrículas y docentes expuestos sin `authMiddleware`. *(medio)*
4. 🟠 **CORS totalmente abierto** (`app.use("*", cors())`). *(pequeño)*
5. 🔴 **Doble lockfile** (`bun.lock` + `package-lock.json`) — fuente de builds inconsistentes. *(pequeño)*

> **Patrón transversal más grave:** el módulo de **autenticación y autorización** concentra varios de los críticos. No es código incompleto cualquiera: es la puerta de entrada de datos académicos personales. Debe ser la prioridad #1 del Release 2.

> **Nota de método — falsos positivos descartados:** verificamos en git que **NO** existen estos problemas frecuentemente asumidos: `.env` con secretos NO está versionado (solo `.env.example`, correctamente ignorado); `dist/` (backend) y `build/` (frontend) NO están en git (gitignored). No se reportan como deuda.

---

## 2. Deuda CRÍTICA (11)

### Seguridad y autenticación (backend)

#### C1 · Bypass de autenticación en modo dev — `Bearer dev-`
- **Ubicación:** `src/shared/middleware/auth-middleware.ts:19`
- **Evidencia:** `const bearerCode = auth?.startsWith("Bearer dev-") ? auth.slice(...) : null;` — si el header empieza con `Bearer dev-`, se extrae el código y se autentica **solo con ese código**, sin validar contraseña, JWT ni versión de token. **Está activo en todos los entornos (no hay check de `NODE_ENV`).**
- **Impacto:** Suplantación total de cualquier alumno con solo conocer su código (visible en el correo institucional). El propio spec (`specs/features/auth/auth.spec.md:241`) pide *"quitar lógica de headers dev-mode"*.
- **Remediación:** Eliminar el prefijo `dev-`. Si se necesita para pruebas, aislarlo tras `NODE_ENV === 'development'` y nunca desplegarlo. **Esfuerzo: pequeño.**

#### C2 · Autenticación "fail-open": usuario mock ante errores de BD
*(Consolida 3 hallazgos que apuntan a la misma raíz.)*
- **Ubicación:** `src/modules/auth/auth.service.ts:102-132` (`loginWithGoogle`), `:148-166` (`me`); `src/shared/middleware/auth-middleware.ts:64-70`; `src/modules/academic-profile/academic-profile.repository.ts:99-112`
- **Evidencia:** Los `catch` devuelven un usuario sintético (`id=0`, `code='00000000'`) **con un JWT firmado** en lugar de propagar el error.
- **Impacto:** Si la BD falla, la API "autentica" a un usuario fantasma y emite tokens válidos. Un atacante podría provocar fallos de BD para autenticarse como `id=0`. Rompe el contrato de seguridad.
- **Remediación:** En el `catch`, lanzar `HttpError(500)` y dejar que el `error-handler` responda. Nunca emitir un JWT en una ruta de error. **Esfuerzo: pequeño.**

#### C3 · Rutas que exponen datos académicos sin autorización
- **Ubicación:** `src/modules/course-detail/course-detail.routes.ts:18-163`, `src/modules/section-management/section-management.routes.ts:9-39`, `src/modules/grades/grades.routes.ts:9-120`
- **Evidencia:** Endpoints como `GET /course-detail/sections`, `/teachers`, `/enrollments`, `/section-management/representatives`, `/grades/me/courses` **no usan `authMiddleware`** y filtran por un `code` opcional en query.
- **Impacto:** Un atacante no autenticado puede enumerar alumnos, docentes, secciones, matrículas y **notas** iterando códigos.
- **Remediación:** Aplicar `authMiddleware` a todas las rutas protegidas + checks de autorización por usuario (cada quien ve solo lo suyo; delegados solo su sección). **Esfuerzo: medio.**

### Arquitectura (backend)

#### C4 · Violación de capas: rutas ejecutan SQL directo contra la BD
- **Ubicación:** `grades.routes.ts:4,24-62`, `section-management.routes.ts:4,11-25`, `course-detail.routes.ts:4,20-58`
- **Evidencia:** Estos `routes` importan `db` y ejecutan `db.execute(sql\`...\`)` directamente. Los controllers se inyectan pero quedan **sin usar** (parámetros con `_`); services y repositories están vacíos.
- **Impacto:** Rompe la arquitectura prometida (routes → controller → service → repository). La lógica de negocio y el acceso a datos viven en el handler HTTP → intestable e inmantenible. Es la causa raíz de C3 (sin capa de servicio, nadie aplica autorización).
- **Remediación:** Crear `GradesRepository`, `SectionManagementRepository`, `CourseDetailRepository` siguiendo el patrón de `auth.repository.ts`; mover el SQL allí; cablear en el `index.ts` del módulo. **Esfuerzo: grande.**

### Testing (ambos)

#### C5 · Cero tests automatizados — backend
- **Ubicación:** `package.json` (no hay script `test` ni runner). Los `specs/**/*.spec.md` son specs en markdown, **no** tests ejecutables.
- **Impacto:** Lógica crítica (auth, notas, validación de matrícula) sin red de regresión. No se puede validar ningún cambio antes de desplegar.
- **Remediación:** Instalar Vitest/Jest, agregar script `test`, empezar por `auth` y `grades`. **Esfuerzo: grande.**

#### C6 · Cero tests automatizados — frontend
- **Ubicación:** no existe `test/`; 0 archivos `*_test.dart` (solo el scaffolding nativo `RunnerTests`).
- **Impacto:** Sin detección de regresiones en flujos de autenticación, cálculo de progreso de malla y carga de datos.
- **Remediación:** Crear `test/` con unit tests de servicios (`auth_service`, `malla_service`), widget tests de páginas clave y un test de integración del login. **Esfuerzo: grande.**

### Dependencias / Build

#### C7 · Doble lockfile en conflicto (`bun.lock` + `package-lock.json`)
- **Ubicación:** ambos versionados en la raíz del backend.
- **Impacto:** No queda claro el gestor canónico; riesgo de versiones distintas entre entornos y CI.
- **Remediación:** `vercel.json` apunta a bun → `git rm package-lock.json`, agregarlo a `.gitignore` y documentarlo. **Esfuerzo: pequeño.**

#### C8 · APK de release firmado con llaves de debug — frontend
- **Ubicación:** `android/app/build.gradle.kts:34-37` → `release { signingConfig = signingConfigs.getByName("debug") }` con TODO.
- **Impacto:** El APK de release no es apto para producción ni para Play Store; viola buenas prácticas de seguridad Android.
- **Remediación:** Crear keystore de release y `signingConfigs.getByName("release")`. **Esfuerzo: pequeño.**

### Fiabilidad (frontend)

#### C9 · Campos `late` accedidos antes de inicializar
- **Ubicación:** `lib/services/courses_service.dart:15,40`, `lib/services/evaluations_service.dart:17,68`, `lib/pages/calculadora/calculadora_controller.dart:9,15,16`
- **Impacto:** Rutas de acceso temprano o race conditions disparan `LateInitializationError` y crashean la app.
- **Remediación:** Validar (`if (!_isLoaded) ...`) o inicializar con valores por defecto en vez de `late`. **Esfuerzo: medio.**

---

## 3. Deuda ALTA (20) — agrupada por tema

### Backend

- **Manejo de errores "tragado" (silent fallbacks)** — repositorios devuelven datos falsos o arrays vacíos en el `catch` (`curriculum.repository.ts`, `academic-profile.repository.ts:100-112`, `schedule.repository.ts:77-79`). El llamador no sabe que falló → corrupción silenciosa de datos.
- **`console.error` masivo en vez de logging estructurado** (`academic-profile.repository.ts`, `auth.service.ts`) — logs no buscables/agregables en producción.
- **`catch` genérico que oculta la causa raíz** (`error-handler.ts:18`) — imposible saber qué query falló.
- **Middleware de auth accede a la BD directamente** (`auth-middleware.ts:4,27,48,96`) — segundo camino de auth fuera de `auth.repository`, acoplamiento fuerte.
- **Tipado débil con `any`** en rutas y repositorios (`course-detail.routes.ts`, `curriculum.repository.ts`) — contradice el `strict` de `tsconfig.json`.
- **CORS permisivo** (`server.ts:13`, `app.use("*", cors())`) — sin validación de origen.
- **Sin validación de parámetros numéricos de ruta** (`course-detail.routes.ts:118,165,209`) — `sectionId='abc'` llega a la BD.
- **Conexión a BD no validada al arranque** (`db/index.ts`, `node-server.ts`) — el server arranca aunque la BD sea inalcanzable.

### Frontend

- **God files** — `malla_page.dart` (1145 líneas), `perfil.dart` (955, con 13 clases privadas). Imposibles de testear y mantener.
- **Estado inconsistente** — mezcla de `setState`, GetX `Obx`/`GetView`, `update()` (`home_page`, `setup_carrera_page`, `perfil`). Sin patrón claro.
- **Instanciación de servicios duplicada / sin DI** (`*_controller.dart`, `malla_page.dart`) — ciclo de vida impredecible, imposible mockear.
- **Colores hardcodeados** dispersos en vez de `themes.dart` (`malla_page.dart:1029,1121`, `horario.dart:42`) — rompe el modo oscuro y DRY.
- **Sin estados de error/carga ante fallos de API** (`calculadora_controller.dart`, `malla_controller.dart:79-98`) — fallos invisibles, sin reintento.
- **App 100% dependiente de red** — sin caché ni degradación offline (`api_client.dart`, `courses_service.dart`).
- **URLs base hardcodeadas a `localhost`** (`api_client.dart:24-35`) — release apunta a localhost → pantallas en blanco.
- **Sin HTTPS forzado / sin validación de certificado** (`api_client.dart`) — riesgo MITM.
- **`main()` sin manejo de excepciones en init async** (`main.dart:17-45`) — crash al arrancar si un servicio falla.

---

## 4. Deuda MEDIA / BAJA (97) — temas recurrentes

**Backend (≈51):**
- Formato de respuesta inconsistente entre módulos (sin envelope tipado).
- `EventBus` singleton inicializado pero **nunca usado**; observers vacíos.
- Validación de contraseña débil; sin rate limiting en login; versión de token no invalida tras logout; `JWT_SECRET` con mínimo débil.
- `bcrypt` con import dinámico en vez de top-level; `Promise.all` en el event bus falla al primer error; rechazos de promesa no manejados.
- Scripts de mantenimiento ad-hoc en la raíz (`apply.cjs`, `apply2.cjs`, `check-db.js`, `test-db.cjs`, `scripts/patch-schedule-classrooms.cjs`) — tooling mezclado `.cjs`/`.ts`.
- Faltan scripts de **lint/format/test** y **CI/CD**; sin health check; sin paginación en listados.
- `.env.example` expone el host real de RDS (`api-mobile-db...us-east-2.rds.amazonaws.com`) — divulgación menor de topología.

**Frontend (≈46):**
- Más god files (`setup_carrera_page.dart` 818, `login_page.dart` 418); `build()` enormes y anidados; faltan `const`.
- `print()` de debug por toda la app; código comentado/muerto; naming mezclado español/inglés.
- `Color.withOpacity()` deprecado usado extensamente; `Map<String, dynamic>` por todos lados (tipado laxo).
- `SharedPreferences` en texto plano para código de alumno y datos de setup; credenciales de prueba en assets; Google Sign-In sin validar `idToken` en servidor.
- `analysis_options.yaml` casi sin reglas (linter desconfigurado); restricciones de dependencias laxas; assets JSON no declarados en `pubspec.yaml`; sin CI/CD.

---

## 5. Hoja de ruta de remediación sugerida

### Sprint 0 — "Quick wins" de seguridad (1–2 días, esfuerzo pequeño, impacto alto)
1. Eliminar bypass `Bearer dev-` (**C1**).
2. Quitar usuarios mock fail-open → lanzar `HttpError(500)` (**C2**).
3. Restringir CORS a orígenes conocidos.
4. Borrar un lockfile y fijar el gestor (**C7**).
5. Configurar firma de release Android (**C8**).

### Sprint 1 — Cerrar la brecha de autorización (esfuerzo medio)
6. Aplicar `authMiddleware` + checks por usuario en todas las rutas expuestas (**C3**).
7. Validar parámetros de ruta y entradas (Zod ya está en el stack).
8. Arreglar campos `late` del frontend (**C9**) y estados de error/carga de API.

### Sprint 2 — Arquitectura y red de pruebas (esfuerzo grande)
9. Refactor de `grades`/`section-management`/`course-detail` a repository/service (**C4**).
10. Introducir testing en backend y frontend (**C5**, **C6**) + un pipeline CI mínimo (lint + test).
11. Descomponer los god files del frontend (`malla_page`, `perfil`) en widgets/controllers.

### Continuo
12. Unificar logging estructurado, manejo de errores y formato de respuesta; mover constantes/colores a config; reemplazar `print()`/`console.error`.

---

## 6. Anexo — Metodología

- Análisis ejecutado con un workflow multi-agente: 10 agentes "finder" (uno por repo × dimensión) en paralelo, seguidos de verificación **adversarial** de cada hallazgo crítico/alto re-leyendo el código real (los hallazgos no confirmados se descartaron).
- 59 agentes, ~1,222 lecturas de archivo. Datos crudos en `_debt_findings.json`.
- Verdades de git confirmadas a mano para evitar falsos positivos (`.env`, `dist/`, `build/`, lockfiles, ausencia de tests).
