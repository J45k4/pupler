import { join } from "node:path";

import { defineConfig } from "prisma/config";

const resolveDatabasePath = () =>
	process.env.DB_PATH ??
	(process.env.DATA_PATH ? join(process.env.DATA_PATH, "pupler.db") : "pupler.db");

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: `file:${resolveDatabasePath()}`,
	},
});
