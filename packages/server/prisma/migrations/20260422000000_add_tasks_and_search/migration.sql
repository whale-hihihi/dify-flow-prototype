-- AlterTable: add default_agent_id to users
ALTER TABLE "users" ADD COLUMN "default_agent_id" VARCHAR(50);

-- CreateTable: tasks
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'immediate',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "agent_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "completed_files" INTEGER NOT NULL DEFAULT 0,
    "cron_expression" VARCHAR(100),
    "prompt" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_items
CREATE TABLE "task_items" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "source_asset_id" TEXT NOT NULL,
    "result_asset_id" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_default_agent_id_key" ON "users"("default_agent_id");
CREATE INDEX "tasks_user_id_idx" ON "tasks"("user_id");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_type_idx" ON "tasks"("type");
CREATE INDEX "task_items_task_id_idx" ON "task_items"("task_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_agent_id_fkey" FOREIGN KEY ("default_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_result_asset_id_fkey" FOREIGN KEY ("result_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
