-- CreateTable
CREATE TABLE "asset_folders" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_folders_asset_id_idx" ON "asset_folders"("asset_id");

-- CreateIndex
CREATE INDEX "asset_folders_folder_id_idx" ON "asset_folders"("folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_folders_asset_id_folder_id_key" ON "asset_folders"("asset_id", "folder_id");

-- AddForeignKey
ALTER TABLE "asset_folders" ADD CONSTRAINT "asset_folders_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_folders" ADD CONSTRAINT "asset_folders_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;