-- Lab 4 Actions Taken foundation (BR-21): additive only. Existing Lab 1-3
-- columns, rows, constraints and foreign keys remain untouched.
--
-- Manual rollback is safe only before Action Taken data is written:
--   DROP TABLE "ActionTakenRevision";
--   DROP TABLE "ActionTaken";
--   DROP TYPE "ActionStatus";
--   ALTER TABLE "Ticket" DROP COLUMN "version";
-- For populated databases, restore the backup taken before migration instead.

CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Ticket" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "performedById" INTEGER NOT NULL,
    "assigneeId" INTEGER,
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT '',
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT NOT NULL DEFAULT '',
    "attachmentNotes" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionTakenRevision" (
    "id" SERIAL NOT NULL,
    "actionTakenId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "editedById" INTEGER NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ActionStatus" NOT NULL,
    "assigneeId" INTEGER,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL,
    "followUpNote" TEXT NOT NULL,
    "attachmentNotes" TEXT NOT NULL,

    CONSTRAINT "ActionTakenRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "id");
CREATE INDEX "ActionTaken_assigneeId_status_idx" ON "ActionTaken"("assigneeId", "status");
CREATE UNIQUE INDEX "ActionTakenRevision_actionTakenId_revision_key" ON "ActionTakenRevision"("actionTakenId", "revision");

ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision"
  ADD CONSTRAINT "ActionTakenRevision_actionTakenId_fkey"
  FOREIGN KEY ("actionTakenId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision"
  ADD CONSTRAINT "ActionTakenRevision_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
