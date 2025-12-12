/*
  Warnings:

  - A unique constraint covering the columns `[kd_dokter]` on the table `Doctor` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Notification_appointmentId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_kd_dokter_key" ON "Doctor"("kd_dokter");
