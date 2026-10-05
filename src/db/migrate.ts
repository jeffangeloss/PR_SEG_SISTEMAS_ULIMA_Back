// Aplica las migraciones pendientes de drizzle/ usando el migrador de
// drizzle-orm (postgres-js), que registra cada una en `drizzle.__drizzle_migrations`.
// Se usa en vez del CLI `drizzle-kit migrate` porque este último trata el NOTICE
// "relation __drizzle_migrations already exists, skipping" como error; el
// migrador de la librería lo maneja bien y es el mismo que correría en runtime.
//
//   bun run db:migrate   (tras `bun run db:generate`)
//
// Requiere datos móviles (el wifi de la ULima bloquea el 5432) y backup previo.

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL en .env");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql);

migrate(db, { migrationsFolder: "./drizzle" })
  .then(async () => {
    console.log("✓ Migraciones al día (drizzle/__drizzle_migrations actualizado).");
    await sql.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("✗ Falló la migración:", e instanceof Error ? e.message : e);
    await sql.end().catch(() => {});
    process.exit(1);
  });
