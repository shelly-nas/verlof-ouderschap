import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "./db";

/** server/migrations, zowel vanuit src/ (tsx) als vanuit dist/ (node). */
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

/**
 * Past openstaande migraties toe, in bestandsvolgorde. Elk bestand draait in
 * een eigen transactie, samen met de registratie in schema_migrations, zodat
 * een halve migratie nooit als gedaan geldt.
 *
 * De server roept dit aan voordat hij gaat luisteren; CI roept het los aan
 * (`require('./dist/migrations').runMigrations()`).
 */
export async function runMigrations(): Promise<string[]> {
  const pool = getPool();
  const applied: string[] = [];

  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version text PRIMARY KEY,
       applied_at timestamptz DEFAULT now()
     )`,
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();

  const { rows } = await pool.query<{ version: string }>("SELECT version FROM schema_migrations");
  const done = new Set(rows.map((row) => row.version));

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      applied.push(file);
      console.log(`Migratie toegepast: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migratie ${file} mislukt: ${(error as Error).message}`);
    } finally {
      client.release();
    }
  }

  return applied;
}
