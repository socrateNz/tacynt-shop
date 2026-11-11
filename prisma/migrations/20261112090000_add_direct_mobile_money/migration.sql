-- CreateEnum
CREATE TYPE "payment_channel" AS ENUM ('CHECKOUT', 'DIRECT');

-- AlterTable
ALTER TABLE "online_order_payments" ADD COLUMN     "canal" "payment_channel" NOT NULL DEFAULT 'CHECKOUT';

-- AlterTable
ALTER TABLE "laundry_payments" ADD COLUMN     "canal" "payment_channel" NOT NULL DEFAULT 'CHECKOUT';

