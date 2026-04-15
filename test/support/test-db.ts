import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..", "..");
const prismaMigrationsPath = join(projectRoot, "prisma", "migrations");

let migrationSqlCache: string | null = null;

const loadMigrationSql = () => {
	if (migrationSqlCache !== null) {
		return migrationSqlCache;
	}

	const sql = readdirSync(prismaMigrationsPath)
		.filter((name) => !name.startsWith("."))
		.filter((name) =>
			statSync(join(prismaMigrationsPath, name)).isDirectory(),
		)
		.sort((left, right) => left.localeCompare(right))
		.map((name) => join(prismaMigrationsPath, name, "migration.sql"))
		.map((path) => readFileSync(path, "utf8").trim())
		.filter(Boolean)
		.join("\n\n");

	migrationSqlCache = sql;
	return sql;
};

export const applyTestSchema = (dbPath: string) => {
	const db = new Database(dbPath, { create: true, strict: true });

	try {
		db.exec("PRAGMA foreign_keys = ON;");
		const sql = loadMigrationSql();
		if (sql) {
			db.exec(sql);
		}
	} finally {
		db.close();
	}
};
