import type { Context, Next } from "hono";
import { config } from "../../config/app-config.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<number, RateLimitEntry>();

const WINDOW_MS = 60 * 60 * 1000;

export async function chatbotRateLimit(c: Context, next: Next) {
  const maxRequests = config.chatbot.rateLimit;
  const studentId = c.get("studentId") as number | undefined;

  if (!studentId) {
    return next();
  }

  const now = Date.now();
  const entry = store.get(studentId);

  if (!entry || now > entry.resetAt) {
    store.set(studentId, { count: 1, resetAt: now + WINDOW_MS });
    c.header("X-RateLimit-Remaining", String(maxRequests - 1));
    c.header("X-RateLimit-Reset", String(Math.ceil((now + WINDOW_MS) / 1000)));
    return next();
  }

  if (entry.count >= maxRequests) {
    const resetInMs = entry.resetAt - now;
    const minutesLeft = Math.ceil(resetInMs / 60000);
    return c.json({
      error: {
        code: "RATE_LIMITED",
        message: `Demasiadas preguntas. Intenta de nuevo en ${minutesLeft} minuto(s).`,
        details: { retryAfterMinutes: minutesLeft },
      },
    }, 429);
  }

  entry.count++;
  c.header("X-RateLimit-Remaining", String(maxRequests - entry.count));
  c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
  return next();
}

// ── POST /specialty-test/me/evaluate (RS-BE-46) ─────────────────────────────
//
// Mismo patrón que `chatbotRateLimit`: contador por alumno del token, en la
// memoria de la instancia, con el mismo límite que ya documentan los contadores
// de arriba (no es un límite distribuido). Cuenta cada evaluación, final o no,
// porque cualquiera puede ser final (un cliente puede repetir el cuerpo del
// resultado) y cada evaluación final llama a Cohere con la misma
// `COHERE_API_KEY` del chatbot: el tope real es de 30 llamadas por alumno por
// hora. Las dos rutas GET del módulo no llevan límite.

const specialtyTestStore = new Map<number, RateLimitEntry>();
export const SPECIALTY_TEST_MAX_PER_HOUR = 30;

export async function specialtyTestRateLimit(c: Context, next: Next) {
  const studentId = c.get("studentId") as number | undefined;
  if (!studentId) return next();

  const now = Date.now();
  const entry = specialtyTestStore.get(studentId);

  if (!entry || now > entry.resetAt) {
    specialtyTestStore.set(studentId, { count: 1, resetAt: now + WINDOW_MS });
    c.header("X-RateLimit-Remaining", String(SPECIALTY_TEST_MAX_PER_HOUR - 1));
    c.header("X-RateLimit-Reset", String(Math.ceil((now + WINDOW_MS) / 1000)));
    return next();
  }

  if (entry.count >= SPECIALTY_TEST_MAX_PER_HOUR) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
    return c.json({
      error: {
        code: "RATE_LIMITED",
        message: `Hiciste demasiados intentos del test. Intenta de nuevo en ${minutesLeft} minuto(s).`,
        details: { retryAfterMinutes: minutesLeft },
      },
    }, 429);
  }

  entry.count++;
  c.header("X-RateLimit-Remaining", String(SPECIALTY_TEST_MAX_PER_HOUR - entry.count));
  c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
  return next();
}
