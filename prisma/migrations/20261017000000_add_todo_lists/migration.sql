CREATE TABLE "todo_lists" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

INSERT INTO "todo_lists" ("id", "name", "created_at", "updated_at")
VALUES (1, 'General', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE "todo_list_members" (
    "todo_list_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" INTEGER NOT NULL CHECK (typeof("role") = 'integer' AND "role" IN (1, 2)),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TEXT NOT NULL,
    PRIMARY KEY ("todo_list_id", "user_id"),
    CONSTRAINT "todo_list_members_todo_list_id_fkey" FOREIGN KEY ("todo_list_id") REFERENCES "todo_lists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "todo_list_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_todo_list_members_user_id" ON "todo_list_members"("user_id");

INSERT INTO "todo_list_members" ("todo_list_id", "user_id", "role", "created_at")
SELECT 1, "id", 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM "users";

CREATE TABLE "new_todos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "todo_list_id" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "due_at" TEXT,
    "completed_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "todos_todo_list_id_fkey" FOREIGN KEY ("todo_list_id") REFERENCES "todo_lists" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_todos" ("id", "todo_list_id", "title", "notes", "status", "due_at", "completed_at", "created_at", "updated_at")
SELECT "id", 1, "title", "notes", "status", "due_at", "completed_at", "created_at", "updated_at" FROM "todos";

DROP TABLE "todos";
ALTER TABLE "new_todos" RENAME TO "todos";
CREATE INDEX "idx_todos_todo_list_id" ON "todos"("todo_list_id");
CREATE INDEX "idx_todos_status" ON "todos"("status");
CREATE INDEX "idx_todos_due_at" ON "todos"("due_at");
