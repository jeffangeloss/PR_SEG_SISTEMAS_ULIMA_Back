import { AppError } from "./app-error.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends AppError {
  constructor(
    readonly statusCode: ContentfulStatusCode,
    message: string,
    code = "HTTP_ERROR",
    details?: unknown,
  ) {
    super(message, code, details);
    this.name = "HttpError";
  }
}
