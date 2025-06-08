/*
  Warnings:

  - The values [rar] on the enum `BotMode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BotMode_new" AS ENUM ('ocr', 'archive', 'location', 'geotags', 'kml', 'workbook');
ALTER TABLE "bot_sessions" ALTER COLUMN "mode" TYPE "BotMode_new" USING ("mode"::text::"BotMode_new");
ALTER TABLE "bot_activities" ALTER COLUMN "mode" TYPE "BotMode_new" USING ("mode"::text::"BotMode_new");
ALTER TABLE "file_metadata" ALTER COLUMN "mode" TYPE "BotMode_new" USING ("mode"::text::"BotMode_new");
ALTER TABLE "bot_feature_config" ALTER COLUMN "feature" TYPE "BotMode_new" USING ("feature"::text::"BotMode_new");
ALTER TYPE "BotMode" RENAME TO "BotMode_old";
ALTER TYPE "BotMode_new" RENAME TO "BotMode";
DROP TYPE "BotMode_old";
COMMIT;
