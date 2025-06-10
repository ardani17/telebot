-- CreateEnum
CREATE TYPE "SettingCategory" AS ENUM ('BOT', 'FILES', 'SECURITY', 'EMAIL', 'RATE_LIMIT', 'CORS', 'WEBHOOK', 'SYSTEM');

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" "SettingCategory" NOT NULL,
    "type" "ConfigType" NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");
