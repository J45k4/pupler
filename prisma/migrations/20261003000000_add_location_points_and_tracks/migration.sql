CREATE TABLE "tracks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "activity_type" TEXT,
    "notes" TEXT,
    "added_by" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "idx_tracks_added_by" ON "tracks"("added_by");
CREATE TABLE "location_points" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "notes" TEXT,
    "latitude" REAL NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
    "longitude" REAL NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
    "added_by" INTEGER NOT NULL,
    "track_id" INTEGER,
    "sequence" INTEGER CHECK ("sequence" IS NULL OR "sequence" >= 0),
    "recorded_at" TEXT,
    "altitude" REAL,
    "accuracy" REAL CHECK ("accuracy" IS NULL OR "accuracy" >= 0),
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CHECK ("track_id" IS NULL OR "sequence" IS NOT NULL),
    FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "idx_location_points_added_by" ON "location_points"("added_by");
CREATE UNIQUE INDEX "location_points_track_sequence_key" ON "location_points"("track_id", "sequence");
