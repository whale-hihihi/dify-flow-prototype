-- Add isTrash column to folders table
ALTER TABLE "folders" ADD COLUMN "is_trash" BOOLEAN NOT NULL DEFAULT false;

-- Add index on is_trash
CREATE INDEX IF NOT EXISTS "folders_is_trash_idx" ON "folders"("is_trash");

-- Add originalFolderId column to assets table
ALTER TABLE "assets" ADD COLUMN "original_folder_id" VARCHAR(50);

-- Add deletedAt column to assets table
ALTER TABLE "assets" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Add isPermanentlyDeleted column to assets table
ALTER TABLE "assets" ADD COLUMN "is_permanently_deleted" BOOLEAN NOT NULL DEFAULT false;

-- Add index on deleted_at
CREATE INDEX IF NOT EXISTS "assets_deleted_at_idx" ON "assets"("deleted_at");

-- Update _prisma_migrations table
INSERT INTO "_prisma_migrations" ("revision", "name", "rolled_back_at", "started_at", "finished_at", "applied_steps_count")
VALUES ('20260422_trash_folder', 'add_trash_folder', NULL, NOW(), NOW(), 1)
ON CONFLICT DO NOTHING;
