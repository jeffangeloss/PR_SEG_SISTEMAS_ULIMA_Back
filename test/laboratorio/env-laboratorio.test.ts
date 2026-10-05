import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
import { envSchema } from "../../src/config/env.js";

/**
 * .env.laboratorio.example sigue al esquema de src/config/env.ts y solo apunta a la máquina local.
 *
 * Lee el archivo como texto, igual que test/devops/env-example.test.ts con .env.example, sin
 * tocar process.env, la red ni la base de datos.
 */
const plantilla = readFileSync(join(import.meta.dir, "..", "..", ".env.laboratorio.example"), "utf8");
const valores = parse(plantilla);

const claves = plantilla
  .split(/\r?\n/)
  .flatMap((linea) => /^([A-Z][A-Z0-9_]*)=/.exec(linea)?.[1] ?? []);
const clavesDeLaApp = claves.filter((clave) => !clave.startsWith("LAB_"));

describe(".env.laboratorio.example", () => {
  test("lleva las variables del esquema en su mismo orden, y después solo LAB_*", () => {
    expect(clavesDeLaApp).toEqual(Object.keys(envSchema.shape));
    const primeraLab = claves.findIndex((clave) => clave.startsWith("LAB_"));
    expect(claves.slice(primeraLab).every((clave) => clave.startsWith("LAB_"))).toBe(true);
  });

  test("no repite ninguna variable", () => {
    expect(claves.filter((clave, i) => claves.indexOf(clave) !== i)).toEqual([]);
  });

  test("sus valores pasan el esquema, así que el backend arranca con ella", () => {
    expect(envSchema.safeParse(valores).success).toBe(true);
  });

  test("la base es la local del laboratorio y coincide con LAB_DB_*", () => {
    const url = new URL(valores.DATABASE_URL);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe(valores.LAB_PG_PORT);
    expect(url.pathname).toBe(`/${valores.LAB_DB_NAME}`);
    expect(url.username).toBe(valores.LAB_DB_USER);
    expect(url.password).toBe(valores.LAB_DB_PASSWORD);
  });

  test("ningún valor apunta a la universidad, a Neon ni a Vercel", () => {
    for (const valor of Object.values(valores)) {
      expect(valor).not.toMatch(/ulima\.edu\.pe|neon\.tech|vercel\.app/);
    }
  });

  test("LAB_DIR queda vacío, así que la plantilla no lleva rutas de ninguna máquina", () => {
    expect(valores.LAB_DIR).toBe("");
    for (const valor of Object.values(valores)) {
      expect(valor).not.toMatch(/\/Users\/|\/home\//);
    }
  });

  test("las contraseñas de las cuentas sintéticas tienen 8 caracteres o más", () => {
    expect(valores.LAB_PASSWORD_ALUMNO.length).toBeGreaterThanOrEqual(8);
    expect(valores.LAB_PASSWORD_DOCENTE.length).toBeGreaterThanOrEqual(8);
  });

  test("git versiona la plantilla e ignora la copia con valores", () => {
    const gitignore = readFileSync(join(import.meta.dir, "..", "..", ".gitignore"), "utf8");
    expect(gitignore).toContain("!.env.laboratorio.example");
  });
});
