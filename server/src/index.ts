import { createApp, version } from "./app";
import { closePool } from "./db";
import { runMigrations } from "./migrations";

const port = Number(process.env.SERVER_PORT ?? 3000);

async function main() {
  // Migraties eerst: de API mag nooit tegen een verouderd schema draaien.
  await runMigrations();

  const server = createApp().listen(port, () => {
    console.log(`verlof-ouderschap ${version} luistert op poort ${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      closePool().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("Starten mislukt:", error);
  process.exit(1);
});
