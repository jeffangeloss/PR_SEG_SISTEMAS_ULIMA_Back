import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * El backend de laboratorio escucha solo en 127.0.0.1.
 *
 * Lee los archivos como texto, sin arrancar el servidor ni tocar la red: con
 * `bun run src/server.ts` bun serviría la app en todas las interfaces, y
 * cualquier equipo de la misma red llegaría a la API del laboratorio.
 */
const raiz = join(import.meta.dir, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

describe("servidor del laboratorio", () => {
  test("levantar-backend.sh arranca servidor-local.ts y no src/server.ts", () => {
    const script = leer("scripts/laboratorio/levantar-backend.sh");
    expect(script).toContain("run scripts/laboratorio/servidor-local.ts");
    expect(script).not.toContain("run src/server.ts");
  });

  test("servidor-local.ts abre el servidor solo en 127.0.0.1", () => {
    const servidor = leer("scripts/laboratorio/servidor-local.ts");
    expect(servidor).toContain('const HOST_LOCAL = "127.0.0.1";');
    expect(servidor).toContain("Bun.serve({ hostname: HOST_LOCAL,");
  });

  test("servidor-local.ts no exporta nada, para que bun no sirva la app por su cuenta", () => {
    const servidor = leer("scripts/laboratorio/servidor-local.ts");
    expect(servidor).not.toMatch(/^export\s/m);
  });
});
