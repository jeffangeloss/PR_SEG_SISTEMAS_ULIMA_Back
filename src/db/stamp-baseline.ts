// TT04 — Sella el baseline de Drizzle como "ya aplicado" en la BD de producción.
//
// Parte del re-baseline (post-demo, requiere datos móviles). La BD viva ya tiene
// TODO el esquema de `drizzle/0000_baseline.sql`, así que NO se debe re-ejecutar
// ese SQL. En vez de eso, este script crea la tabla de control de Drizzle
// (`drizzle.__drizzle_migrations`) y registra el baseline como aplicado. A
// partir de ahí, `bun run db:migrate` (drizzle-kit) aplicará SOLO las
// migraciones futuras y las irá registrando; se retoma el flujo oficial.
//
//   bun run db:stamp-baseline            # DRY-RUN: muestra qué haría
//   bun run db:stamp-baseline -- --apply # ejecuta
//
// Idempotente: si el baseline ya está registrado, no hace nada.
//
// Cómo decide Drizzle qué aplicar (verificado en node_modules/drizzle-orm):
// guarda `hash = sha256(contenido del .sql)` y `created_at = journal.when`, y
// omite toda migración cuyo `when <= max(created_at)` ya registrado.

import "dotenv/config";
import postgres from "postgres";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const DRIZZLE_DIR = join(import.meta.dir, "..", "..", "drizzle");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL en .env");
  process.exit(1);
}

type JournalEntry = { idx: number; when: number; tag: string };

function loadBaseline() {
  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  if (journal.entries.length === 0) throw new Error("El journal de Drizzle está vacío.");
  // El baseline es la primera entrada (idx 0). Se sella esa y cualquier otra
  // anterior a "hoy" que ya esté reflejada en la BD (normalmente solo el baseline).
  return journal.entries.map((e) => {
    const sql = readFileSync(join(DRIZZLE_DIR, `${e.tag}.sql`), "utf8");
    return { tag: e.tag, when: e.when, hash: createHash("sha256").update(sql).digest("hex") };
  });
}

const sql = postgres(DATABASE_URL);

async function main() {
  const migrations = loadBaseline();
  console.log(`\n=== Sellar baseline de Drizzle — ${APPLY ? "APPLY" : "DRY-RUN"} ===\n`);
  console.log("Se registrarán como aplicadas (sin re-ejecutar su SQL):");
  for (const m of migrations) {
    console.log(`  ${m.tag}  (when=${m.when}, hash=${m.hash.slice(0, 12)}…)`);
  }

  if (!APPLY) {
    console.log(`\n(DRY-RUN) No se escribió nada. Corre con --apply cuando estés en datos móviles y post-demo.\n`);
    return;
  }

  await sql.begin(async (tx) => {
    await tx`create schema if not exists drizzle`;
    await tx`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `;
    for (const m of migrations) {
      const existing = (await tx`
        select 1 from drizzle.__drizzle_migrations where created_at = ${m.when} limit 1
      `) as unknown as Array<{ "?column?": number }>;
      if (existing.length > 0) {
        console.log(`  ya registrado: ${m.tag}`);
        continue;
      }
      await tx`
        insert into drizzle.__drizzle_migrations (hash, created_at) values (${m.hash}, ${m.when})
      `;
      console.log(`  ✓ sellado: ${m.tag}`);
    }
  });

  console.log(`\n✓ Baseline sellado. Verificación:`);
  const rows = (await sql`
    select hash, created_at from drizzle.__drizzle_migrations order by created_at
  `) as unknown as Array<{ hash: string; created_at: number }>;
  for (const r of rows) console.log(`  created_at=${r.created_at}  hash=${r.hash.slice(0, 12)}…`);
  console.log(`\nDesde ahora usa: bun run db:generate (crea migración) + bun run db:migrate (aplica y registra).\n`);
}

main()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("\n✗ Falló:", e instanceof Error ? e.message : e);
    await sql.end().catch(() => {});
    process.exit(1);
  });
