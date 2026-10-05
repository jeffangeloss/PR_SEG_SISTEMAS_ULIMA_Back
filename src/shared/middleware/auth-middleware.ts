import type { MiddlewareHandler } from "hono";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { config } from "../../config/app-config.js";
import { HttpError } from "../errors/http-error.js";

export type AuthVariables = {
  userId: number;
  // Presente solo en tokens de alumno; ausente en tokens de docente (HU18).
  studentId?: number;
  // Presente solo en tokens de docente (HU18).
  teacherId?: number;
  role: string;
};

const isPayload = (payload: string | JwtPayload): payload is JwtPayload =>
  typeof payload !== "string";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // Autenticación exclusivamente por JWT Bearer. No se aceptan códigos por
  // query (`?code=`), header `X-User-Code` ni el prefijo `Bearer dev-`:
  // esas vías permitían suplantar a cualquier usuario sin credenciales.
  const auth = c.req.header("Authorization");
  if (!auth) {
    throw new HttpError(401, "No se envió token de autenticación.", "MISSING_TOKEN");
  }

  const [type, token] = auth.split(" ");
  if (type !== "Bearer" || !token) {
    throw new HttpError(401, "Token de autenticación inválido.", "INVALID_TOKEN");
  }

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    if (!isPayload(payload)) {
      throw new HttpError(401, "Token de autenticación inválido.", "INVALID_TOKEN");
    }

    const userId = Number(payload.sub);
    const role = payload.role;
    const tokenVersion = Number(payload.tokenVersion);
    if (!Number.isInteger(userId) || typeof role !== "string" || !Number.isInteger(tokenVersion)) {
      throw new HttpError(401, "Token de autenticación inválido.", "INVALID_TOKEN");
    }

    // HU18: un token de docente lleva `teacherId` en vez de `studentId`. Se
    // exige el identificador que corresponde al rol; el otro debe estar ausente.
    const isTeacher = role === "teacher";
    const studentId = Number(payload.studentId);
    const teacherId = Number(payload.teacherId);
    if (isTeacher) {
      if (!Number.isInteger(teacherId)) {
        throw new HttpError(401, "Token de autenticación inválido.", "INVALID_TOKEN");
      }
    } else if (!Number.isInteger(studentId)) {
      throw new HttpError(401, "Token de autenticación inválido.", "INVALID_TOKEN");
    }

    // Validar tokenVersion contra la BD (Single Active Session).
    const result = await db.execute(sql`
      select token_version from app_user where id = ${userId} limit 1
    `) as unknown as Array<{ token_version: number }>;

    const dbTokenVersion = result[0]?.token_version;
    if (dbTokenVersion == null || dbTokenVersion !== tokenVersion) {
      throw new HttpError(401, "Token de autenticación revocado o inválido.", "INVALID_TOKEN");
    }

    c.set("userId", userId);
    c.set("role", role);
    if (isTeacher) {
      c.set("teacherId", teacherId);
    } else {
      c.set("studentId", studentId);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Token de autenticación inválido o expirado.", "INVALID_TOKEN");
  }

  await next();
};

/**
 * HU18: autorización por rol. Corre DESPUÉS de `authMiddleware` (que ya setó
 * `role` en el contexto) y responde 403 si el rol no está permitido. Evita que
 * un token de docente ejecute rutas de alumno con `studentId` ausente (y
 * viceversa). Uso: `app.use("*", authMiddleware); app.use("*", requireRole(...))`
 * o por-ruta `app.get("/x", authMiddleware, requireRole("teacher"), handler)`.
 */
export const requireRole = (...roles: string[]): MiddlewareHandler => async (c, next) => {
  const role = c.get("role");
  if (typeof role !== "string" || !roles.includes(role)) {
    throw new HttpError(403, "No tiene permisos para acceder a este recurso.", "FORBIDDEN");
  }
  await next();
};

/** Roles de alumno: usados por los módulos de estudiante para excluir docentes. */
export const STUDENT_ROLES = ["student", "delegate", "subdelegate"] as const;
