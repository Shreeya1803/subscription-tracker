-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "last_reminder_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "push_token" TEXT;
