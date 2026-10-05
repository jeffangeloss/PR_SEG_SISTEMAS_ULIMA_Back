import type { Context } from "hono";
import type { ZodSchema } from "zod";
import { HttpError } from "../errors/http-error.js";

export const validateJson = async <T>(c: Context, schema: ZodSchema<T>) => {
  const body = await c.req.json().catch(() => {
    throw new HttpError(400, "Invalid JSON body", "INVALID_JSON_BODY");
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "Invalid request body", "INVALID_REQUEST_BODY", result.error.flatten());
  }

  return result.data;
};

export const validateQuery = <T>(c: Context, schema: ZodSchema<T>) => {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new HttpError(400, "Invalid query params", "INVALID_QUERY_PARAMS", result.error.flatten());
  }

  return result.data;
};

export const validateParams = <T>(c: Context, schema: ZodSchema<T>) => {
  const result = schema.safeParse(c.req.param());
  if (!result.success) {
    throw new HttpError(400, "Invalid route params", "INVALID_ROUTE_PARAMS", result.error.flatten());
  }

  return result.data;
};
