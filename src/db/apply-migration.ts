// Aplica un archivo .sql de migración en UNA transacción, reutilizando la misma
// conexión que la app (postgres.js con la DATABASE_URL de .env). Evita depender
// de psql y de su manejo de SSL: si la app conecta a RDS, este script también.
// Requiere datos móviles (el wifi de la ULima bloquea el 5432).
//
//   bun run db:apply drizzle/0004_advising_teacher_role.sql
//
// La migración se ejecuta atómica: si un statement falla, se hace ROLLBACK y la
// BD queda intacta. El SQL es idempotente (IF NOT EXISTS / guardas), así que
// puede re-aplicarse sin daño.

import "dotenv/config";
import postgres from "postgres";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: bun run db:apply <archivo.sql>");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL en .env");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const content = readFileSync(file, "utf8");

async function main() {
  console.log(`Aplicando ${file} en una transacción...`);
  // unsafe() sin parámetros usa el protocolo simple → admite múltiples
  // statements y bloques DO $$ ... $$. El sql.begin envuelve todo en una tx.
  await sql.begin(async (tx) => {
    await tx.unsafe(content);
  });
  console.log(`✓ Migración aplicada: ${file}`);
}

main()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("\n✗ Migración falló (ROLLBACK):", e instanceof Error ? e.message : e);
    await sql.end().catch(() => {});
    process.exit(1);
  });
