const knex = require("knex");

let knexInstance;

const buildPgConfig = () => {
  // Prefer a single URL when available (matches common Prisma/railway style)
  const databaseUrl = process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST || "postgres";
  const port = Number(process.env.POSTGRES_PORT || 5432);
  const database = process.env.POSTGRES_DB || "thehub";
  const user = process.env.POSTGRES_USER || "thehub";
  const password = process.env.POSTGRES_PASSWORD || "thehub";
  const ssl = (process.env.POSTGRES_SSL || "false").toLowerCase() === "true";

  return {
    client: "pg",
    connection: databaseUrl
      ? databaseUrl
      : {
          host,
          port,
          database,
          user,
          password,
          ssl: ssl ? { rejectUnauthorized: false } : false,
        },
    pool: {
      min: 0,
      max: Number(process.env.POSTGRES_POOL_MAX || 10),
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "./pg/migrations",
    },
  };
};

const getPg = () => {
  if (!knexInstance) {
    knexInstance = knex(buildPgConfig());
  }
  return knexInstance;
};

const connectPG = async () => {
  try {
    const db = getPg();
    await db.raw("select 1 as ok");
    console.log(
      `Connected to postgres://${process.env.POSTGRES_HOST || "postgres"}:${
        process.env.POSTGRES_PORT || 5432
      }/${process.env.POSTGRES_DB || "thehub"}`
    );
  } catch (error) {
    console.error("Postgres connection failed:", error?.message || error);
    process.exit(1);
  }
};

const migratePG = async () => {
  const db = getPg();
  const cfg = buildPgConfig();
  const migrationsDir =
    (cfg.migrations && cfg.migrations.directory) || "./pg/migrations";

  const [batchNo, log] = await db.migrate.latest({
    directory: migrationsDir,
    tableName: (cfg.migrations && cfg.migrations.tableName) || "knex_migrations",
  });

  return { batchNo, log };
};

module.exports = { getPg, connectPG, migratePG, buildPgConfig };
