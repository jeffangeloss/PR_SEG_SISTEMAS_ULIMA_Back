import type { ErrorHandler } from "hono";
import { HttpError } from "../errors/http-error.js";

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof HttpError) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      error.statusCode,
    );
  }

  console.error("Unhandled error:", error);

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
      },
    },
    500,
  );
};
