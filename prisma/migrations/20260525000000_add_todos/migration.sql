CREATE TABLE "todos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "due_at" TEXT,
    "completed_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

CREATE INDEX "idx_todos_status" ON "todos"("status");
CREATE INDEX "idx_todos_due_at" ON "todos"("due_at");
