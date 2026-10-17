-- AlterTable
ALTER TABLE "users" ADD COLUMN     "premium_expires_at" TIMESTAMP(3),
ADD COLUMN     "premium_product_id" TEXT,
ADD COLUMN     "premium_store" TEXT;

-- AlterTable
ALTER TABLE "payment_events" ADD COLUMN     "event_id" TEXT,
ADD COLUMN     "event_type" TEXT,
ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_event_id_key" ON "payment_events"("event_id");