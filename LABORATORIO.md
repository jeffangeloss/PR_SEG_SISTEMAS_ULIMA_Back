# Variante de laboratorio del backend de ULima++

La rama `laboratorio/sin-portal` deriva de la versión v2.1.0 del backend y retira la integración con el portal institucional de la Universidad de Lima, junto con las funciones que dependen de ella. La variante corre entera en una sola máquina, contra un Postgres local con el catálogo de la carrera y con personas sintéticas, y no se conecta a ningún sistema de la Universidad.

`specs/` y `docs/` conservan la descripción de v2.1.0, y en este repositorio solo cambian los datos personales que trata la sección «Datos personales». El `README.md` también describe v2.1.0 y lleva al comienzo un aviso que remite a este archivo. Por lo mismo, `scripts/verificar-readme.py` comprueba el README de v2.1.0 y no aplica a esta variante.

## Origen de este repositorio

Este repositorio parte de la versión v2.1.0 de https://github.com/jeffangeloss/ULima_Backend_IS2 (tag `v2.1.0`, commit `487d35e`) más dos commits de laboratorio, `1c62d92` y `db661ea`, hechos en la rama local `laboratorio/sin-portal` de un clon de análisis. Ni esos commits ni esa rama están publicados en el repositorio original. Su contenido llega sin el historial de git, y el historial hasta v2.1.0 queda en el repositorio original. Tampoco trae `.github/workflows/release.yml`, que en el repositorio original crea la versión y el GitHub Release al subir a `main`, mientras que la integración continua de `.github/workflows/ci.yml` se conserva.

## Qué se retira y por qué

En v2.1.0 el backend lee datos de dos sistemas de la Universidad, que son miUlima (`webaloe.ulima.edu.pe/portalUL`) para el registro, las notas, la asistencia y el récord académico, y el servidor Domino de sílabos (`cactus.ulima.edu.pe`). La variante retira estas dos conexiones y, con ellas, lo que existe solo para servirlas, porque sin el portal estas piezas no tienen datos que leer ni nada que reparar.

| Pieza de v2.1.0 | Qué hace en v2.1.0 | En la variante |
|---|---|---|
| Módulo `portal-sync` y `src/services/portal.client.ts` | Inicia sesión en miUlima, importa matrícula, horario, notas, asistencia y récord, y recarga notas y asistencia | Se retira |
| `POST /auth/register` y sus limitadores | Crea la cuenta con las credenciales de miUlima | Se retira; las cuentas salen del seed sintético |
| Variables `PORTAL_*` y `SYLLABUS_*` | Configuran las dos conexiones | Se retiran de `env.ts`, `app-config.ts` y `.env.example` |
| `/academic-record` y sus tres tablas | Guardan una copia del récord del portal | Se retiran |
| `GET /grades/me/ulima` y `student_portal_score` | Muestran las notas leídas del Aula Virtual | Se retiran |
| `section_representative_claim` | Guarda los delegados que reporta el portal, aunque no tengan cuenta | Se retira; `section_representative` se conserva |
| `course_equivalence` y su seed | Empareja los códigos antiguos del récord con la malla | Se retiran |
| `course.weekly_hours`, `malla_horas.ts` y `backfill_total_hours.ts` | Calculan las horas de la oferta durante la importación | Se retiran |
| `fusionar-docentes` | Repara los docentes duplicados que crea la importación | Se retira |
| Modo estático (`MODO_ESTATICO`, `app_setting`, `GET /config`, respuestas 503) | Apaga lo que consulta a la Universidad sin redesplegar | Se retira entero |

La asistencia se conserva. Las columnas `enrollment.attended_hours`, `absent_hours` y `total_hours`, y `course_offering.total_hours`, siguen con sus CHECK, el módulo `/attendance-risk` sigue completo y las secciones siguen respondiendo `asistido`, `inasistencia`, `total`, `asistenciaDisponible` y `horasTranscurridas`. En el laboratorio estas horas las escribe el seed sintético. Solo se retiran las marcas de lectura del portal, que son `enrollment.portal_attendance_read_at`, `portal_grades_read_at` y el campo `asistenciaLeidaEn`.

Donde v2.1.0 elige entre una rama estática y una dinámica, la variante deja una sola. La asistencia y su riesgo se muestran, como en la rama dinámica, y las alertas «Alerta de inasistencias - » llegan al contexto del chatbot, porque el riesgo de asistencia las sigue creando. En lo demás queda la rama estática, así que los sílabos se publican solo como enlaces de Drive.

El esquema cambia con la migración `drizzle/0017_laboratorio_sin_portal.sql`, que es solo para la base del laboratorio, destructiva e idempotente. Borra las siete tablas de la tabla anterior, las columnas `enrollment.final_grade`, `portal_grades_read_at`, `portal_attendance_read_at` y `course.weekly_hours`, y sus dos CHECK. `MIGRATIONS.md` registra su aplicación al final, en la sección «Variante de laboratorio». Las migraciones de la `0000` a la `0016` no se editan.

Para la app, la variante cambia el contrato en estos puntos. Dejan de existir `POST /auth/register`, `/portal-sync/*`, `GET /config`, `/academic-record/me` y `GET /grades/me/ulima`, que responden 404. Las secciones ya no traen `asistenciaLeidaEn` y los contactos de la sección ya no traen `representantesPendientes`.

## Base de datos de laboratorio

La base es un Postgres 16 de Homebrew propio del laboratorio. Sus datos viven en la carpeta que fija `LAB_DIR`, y si la variable queda vacía los scripts usan la carpeta `.lab` junto a la que contiene el repositorio, fuera de él. El servidor escucha solo en `127.0.0.1:5433`, así que no choca con otro Postgres en el 5432. Toda la configuración sale de `.env.laboratorio`, una copia de la plantilla versionada que git ignora.

```bash
cp .env.laboratorio.example .env.laboratorio
BUN=/ruta/a/bun scripts/laboratorio/levantar-bd.sh            # crea o arranca, sin borrar nada
BUN=/ruta/a/bun scripts/laboratorio/levantar-bd.sh --reset    # borra la base y la reconstruye
scripts/laboratorio/detener-bd.sh                             # detiene Postgres; los datos quedan
```

Los mismos tres comandos existen como `lab:bd:levantar`, `lab:bd:reset` y `lab:bd:detener` en `package.json`. La variable `BUN` hace falta cuando `bun` no está en el `PATH`.

`levantar-bd.sh` se niega a correr antes de escribir nada si existe un `.env` en la raíz del repositorio, porque bun y dotenv lo cargarían solos y podrían traer la URL de otra base. También se niega si `DATABASE_URL` no es exactamente la base local que describen las variables `LAB_DB_*` o si `LAB_DIR` queda dentro del repositorio. Después crea el clúster la primera vez, lo arranca, crea el rol y la base, arma el esquema, carga los datos y verifica el resultado.

El esquema se arma con el mismo mecanismo del repositorio. `db:migrate` aplica el journal de drizzle, que llega a la `0009`, y después `db:apply` aplica en orden `0001_course_offering_total_hours.sql` y de la `0010` a la `0017`. El script no aplica `0002_app_user_linkedin_link.sql`, porque `teacher.linkedin_link` no existe en `schema.ts`, ni corre `stamp-baseline.ts`, que marca el baseline como aplicado sin crear las tablas. Sobre una base que ya existe no reaplica el esquema, porque el baseline no es idempotente.

La verificación final comprueba que no queden las tablas ni las columnas retiradas, que la base tenga las 36 tablas de `schema.ts`, que toda cuenta y todo docente sean sintéticos, que haya un solo período activo, que toda matrícula y toda oferta tengan horas de asistencia, y que haya un delegado y un subdelegado activos.

## Datos del laboratorio

El catálogo institucional sale de `src/db/seed/laboratorio.catalogo.json`, exportado una sola vez y sin personas. Trae la carrera, la malla con sus 74 cursos, los requisitos, las siete especialidades y los tipos de evaluación. Todo lo demás lo genera `src/db/seed/laboratorio.ts` a partir de `laboratorio.datos.ts` y de la lógica pura de `laboratorio.logic.ts`, que prueba `test/laboratorio/seed-laboratorio.test.ts`.

Las personas son inventadas. Los alumnos tienen códigos de `20990001` a `20990012` y correo `<código>@laboratorio.test`, las cuentas docentes son `lab.docente1` y `lab.jp1`, y los nombres no corresponden a nadie. Las contraseñas no están en el código, porque el seed las lee de `LAB_PASSWORD_ALUMNO` y `LAB_PASSWORD_DOCENTE`, cuyos valores de laboratorio están en `.env.laboratorio.example`, y solo se fijan al crear cada cuenta.

| Cuenta | Rol al iniciar sesión | Para qué sirve |
|---|---|---|
| `20990001` | `delegate` | Delegada de LAB-1, autora del aviso, con un bloque propio y carnet de networking |
| `20990002` | `subdelegate` | Subdelegado de LAB-1 |
| `20990003`, `20990004`, `20990007` y `20990008` | `student` | Ciclo 6, con LAB-1 a LAB-4; `20990007` tiene un curso desaprobado |
| `20990005` | `student` | En riesgo de asistencia en LAB-1 |
| `20990006` | `student` | Impedido por inasistencias en LAB-1 |
| `20990009` a `20990011` | `student` | Ciclo 7, con LAB-4 a LAB-7 |
| `20990012` | ninguno | Sin matrícula activa; su inicio de sesión responde 403 `NOT_ENROLLED` |
| `lab.docente1` | `teacher` | Profesora de LAB-1, LAB-3 y LAB-7, con asesorías |
| `lab.jp1` | `teacher` | Jefe de práctica de LAB-1 |

El período activo es 2026-2, del 24 de agosto al 13 de diciembre de 2026, con 16 semanas. Hay siete secciones, de LAB-1 a LAB-7, una por curso, con dos sesiones de 2 horas por semana en franjas que no se cruzan, sílabo con enlace a `laboratorio.test` y cuatro evaluaciones, de las que solo la PC1 tiene nota publicada. Como el backend publica solo enlaces de Drive, `GET /grades/me/courses` devuelve `silaboUrl` en `null` para estos sílabos. Cada matrícula lleva horas de asistencia hasta la semana en curso, y nunca menos de 6 semanas, para que el riesgo de asistencia tenga casos aunque el seed corra al comienzo del ciclo. Con este mínimo, antes de la semana 6 `horasTranscurridas` adelanta el calendario real. El avance de malla da por aprobados los cursos obligatorios de los ciclos anteriores al nivel del alumno, marca en curso lo que lleva y respeta los requisitos del catálogo.

El seed es idempotente y se niega a escribir si la base tiene alguna cuenta fuera de los patrones `2099xxxx` y `lab.*`, o si `DATABASE_URL` no apunta a esta máquina. Sin `--apply` solo imprime el plan.

Los seeds heredados de v2.1.0 que traen personas reales no forman parte de este repositorio, como explica la sección «Datos personales». El de asesorías (`asesorias.ts` y `asesorias.logic.ts`), que lee personas de archivos de la facultad que no están en el repositorio, conserva su código y solo cambia comentarios que citaban `portal-sync`; el laboratorio tampoco lo ejecuta.

## Datos personales

Este repositorio no incluye los seeds de v2.1.0 con alumnos reales (`delegados_secciones.ts`, `docentes.ts`, `notas_855.ts`, `propuesta_855.ts` y `repr_855.ts`), el script de diagnóstico que lleva un código de alumno en su nombre ni el archivo de hallazgos de la auditoría técnica, `_debt_findings.json`, que transcribe contraseñas en texto plano. Los códigos, usuarios y nombres de personas reales que aparecen en las pruebas y los documentos de v2.1.0 se reemplazan aquí por valores ficticios, con el mismo formato para que las pruebas sigan pasando. Por eso algunos documentos que describen v2.1.0 mencionan archivos que este repositorio no trae.

## Backend de laboratorio

Con la base arriba, el backend arranca contra ella con las variables de `.env.laboratorio`, sin crear un `.env` en la raíz. Queda en primer plano en `http://127.0.0.1:3000` y se detiene con Ctrl+C. Escucha solo en `127.0.0.1`, así que ningún otro equipo de la red llega a la API del laboratorio; el emulador de Android llega igual por `10.0.2.2`, que apunta a esa misma dirección del equipo.

```bash
BUN=/ruta/a/bun scripts/laboratorio/levantar-backend.sh
# equivale a: bun --env-file=.env.laboratorio run scripts/laboratorio/servidor-local.ts
```

El script repite las guardas de `levantar-bd.sh` y además exige que el Postgres del laboratorio esté corriendo. Para apagar todo, primero se detiene el backend y después se corre `detener-bd.sh`.

## Funciones sin servicio externo

La plantilla deja vacíos o ficticios los servicios externos, así que estas funciones no operan en el laboratorio. El resto de la API usa solo la base local.

| Función | Servicio | Comportamiento en el laboratorio |
|---|---|---|
| Chat de sección | Firebase | Sin credenciales, el backend no firma tokens de chat y el arranque avisa «Chat features will not work»; la pertenencia a los chats sí está en la base |
| Chatbot | Cohere | La clave ficticia `laboratorio-sin-cohere` no autoriza llamadas, así que el chatbot no responde preguntas; el test de especialidad funciona y, cuando Cohere falla, su motivo sale de las plantillas |
| Fotos de perfil | Cloudinary | Sin credenciales, no se suben fotos y la app muestra iniciales |
| Correos | Resend | Sin clave, no se envía el código de restablecimiento; con `NODE_ENV=development` se imprime en la consola con `[DEV ONLY]` |
| Inicio de sesión con Google | Google | Acepta solo correos institucionales de la Universidad, así que no sirve con las cuentas `@laboratorio.test` |

Quien quiera probar una de estas funciones puede poner credenciales propias en su `.env.laboratorio`, que no se versiona, y nunca las de producción.
