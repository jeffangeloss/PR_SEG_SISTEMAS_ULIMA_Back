---
name: Carnet de networking (HU25)
description: Carnet opcional con una red social editable para alumnos y docentes
targets:
  - ../../../src/modules/networking/**
  - ../../../src/modules/index.ts
  - ../../../test/networking.logic.test.ts
  - ../../../test/networking.schemas.test.ts
  - ../../../test/networking.service.test.ts
---

# Carnet de networking

> **Spec aprobada para el Escenario 1 de HU25.** Esta historia fue identificada
> como HU27 en documentos e issues iniciales. La migración
> `drizzle/0001_flowery_jack_flag.sql` ya fue aplicada a producción el
> 11 de julio de 2026. Esta implementación no modifica el esquema ni ejecuta
> migraciones.

Issues históricos: HU27_Backend #52 y HU27_Frontend #143. El nombre canónico de
producto es **HU25 - Carnet de networking (redes sociales opt-in)**.

## Historia de usuario

Como **alumno o docente**, quiero activar un carnet de networking opcional y
elegir una red social, para compartir un medio de contacto dentro de la app.

## Modelo de datos existente

- `app_user.networking_opt_in`: opt-in explícito; `false` mantiene el carnet
  privado.
- `user_social_link`: enlace asociado directamente a `app_user`, con
  `platform`, `url` y `label` opcional.
- `social_platform`: `linkedin | instagram | github | x | website | other`.

Aunque la tabla permite una fila por plataforma, HU25 limita el carnet a
**una sola fila total por usuario** mediante reglas de aplicación. No se agrega
una columna de enlace destacado ni se cambia la base de datos.

## Alcance del Escenario 1

### R-NET-1 - Consultar mi carnet

- `GET /networking/me` requiere un JWT válido y responde siempre el carnet del
  propietario autenticado: `{ optIn, links }`.
- `links` contiene cero o un elemento `{ platform, url, label }`; `label` es
  `string | null` para mantener un response shape estable.
- El propietario puede leer su enlace aunque `optIn` sea `false`; ocultar el
  carnet no borra información.
- Aplica a todos los roles autenticados actuales: `student`, `delegate`,
  `subdelegate` y `teacher`. No existe una autorización académica adicional.
- Si el `app_user` del JWT no existe, responde `404 USER_NOT_FOUND`.
  `[@test] ../../../test/networking.service.test.ts`

### R-NET-2 - Actualizar mi carnet

- `PUT /networking/me` recibe exactamente
  `{ optIn: boolean, links: SocialLink[] }` y responde el carnet actualizado.
- El propietario se deriva exclusivamente de `JWT.sub` (`userId` del contexto);
  el body no acepta identificadores de usuario.
- La escritura reemplaza atómicamente el conjunto de enlaces y el opt-in dentro
  de una transacción.
- `optIn: true` exige exactamente un enlace.
- `optIn: false` acepta cero o un enlace. Enviar el enlace actual junto con
  `optIn: false` lo conserva oculto; enviar `links: []` lo elimina
  explícitamente.
- Nunca se acepta más de una red total por carnet. Cambiar de red reemplaza la
  fila anterior.
  `[@test] ../../../test/networking.service.test.ts`

### R-NET-3 - Validación del enlace

- `platform` debe pertenecer a `social_platform`.
- `url` se recorta, debe ser una URL absoluta `http://` o `https://` y tener
  como máximo 255 caracteres.
- Para plataformas conocidas, el host debe coincidir con su dominio oficial o
  un subdominio suyo:
  - `linkedin`: `linkedin.com`
  - `instagram`: `instagram.com`
  - `github`: `github.com`
  - `x`: `x.com` o `twitter.com`
- `website` y `other` aceptan cualquier host HTTP(S), pero requieren `label` no
  vacía de máximo 80 caracteres.
- Para las demás plataformas, `label` es opcional y, si se recibe, se recorta.
- Un body inválido responde `400 INVALID_REQUEST_BODY` con detalles de Zod.
  `[@test] ../../../test/networking.schemas.test.ts`
  `[@test] ../../../test/networking.logic.test.ts`

### R-NET-4 - Privacidad y persistencia

- `networking_opt_in = false` oculta el carnet frente a otros consumidores,
  pero el endpoint propio sigue retornando el enlace guardado.
- Desactivar la visibilidad no implica borrar: el cliente conserva el enlace al
  enviar el mismo elemento con `optIn: false`.
- PostgreSQL es la única fuente de verdad. No se usan JSON, mocks persistentes,
  seeds ni el antiguo `teacher.linkedin_link`.
- Se respeta la arquitectura
  `routes -> controller -> service -> repository`, con lógica pura separada,
  Zod y `HttpError`.
  `[@test] ../../../test/networking.service.test.ts`

## Fuera de alcance

- `GET /networking/users/:userId` y la vista pública desde contactos.
- Compartir el carnet en Firebase/chat de sección.
- QR, descarga, directorio global, conexiones o mensajería nueva.
- Más de una red guardada o una red destacada.
- Cambios de esquema, migraciones o seeds.
