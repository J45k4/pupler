import {
	resolveDatabasePath,
	resolveFilesPath,
} from "./config";
import { openDatabase, type Database } from "./api/core";

export const dbPath = resolveDatabasePath();
export const filesPath = resolveFilesPath(dbPath);

export let db: Database;

export const setDatabase = (database: Database) => {
	db = database;
	return db;
};

export const initializeDatabase = () =>
	setDatabase(openDatabase(dbPath, filesPath));
