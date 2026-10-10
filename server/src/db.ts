import { Pool, type PoolClient, types } from "pg";

// DATE blijft een "yyyy-MM-dd"-string. Standaard maakt pg er een Date van op
// lokale middernacht, en die schuift in Amsterdam een dag zodra iemand er
// toISOString() op loslaat. Een verlofdag is een kalenderdag, geen tijdstip.
types.setTypeParser(types.builtins.DATE, (value) => value);
// NUMERIC komt standaard als string binnen; de rekenkern werkt met getallen.
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

let pool: Pool | null = null;

/** De pool wordt pas bij de eerste query aangemaakt, zodat tests zonder database draaien. */
export function getPool(): Pool {
  pool ??= new Pool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10,
  });
  return pool;
}

export type Queryable = Pick<PoolClient, "query">;

/** Draait `work` in één transactie; bij een fout wordt alles teruggedraaid. */
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
