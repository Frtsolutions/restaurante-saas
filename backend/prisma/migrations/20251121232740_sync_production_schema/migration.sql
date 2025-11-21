-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';
