const path = require("path");
const { getPg, buildPgConfig } = require("../config/pg");

const run = async () => {
  const pg = getPg();
  const cfg = buildPgConfig();

  // Ensure migrations directory is resolved from backend/ root when invoked anywhere
  const migrationsDir = path.resolve(__dirname, "..", "pg", "migrations");
  pg.client.config.migrations = {
    ...(cfg.migrations || {}),
    directory: migrationsDir,
  };

  try {
    const [batchNo, log] = await pg.migrate.latest({
      directory: migrationsDir,
      tableName: (cfg.migrations && cfg.migrations.tableName) || "knex_migrations",
    });

    if (log.length === 0) {
      console.log("Postgres migrations: already up to date");
    } else {
      console.log(`Postgres migrations batch ${batchNo} applied:`);
      for (const file of log) console.log(`- ${file}`);
    }
  } finally {
    await pg.destroy();
  }
};

run().catch((err) => {
  console.error("Postgres migrations failed:", err);
  process.exit(1);
});

