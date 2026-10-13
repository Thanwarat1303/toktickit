import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";

const migrationDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "prisma", "migrations");
const lab4Migration = "20261013090000_lab4_actions_taken";
const earlierMigrations = readdirSync(migrationDir).filter((name) => /^\d{14}_/.test(name) && name < lab4Migration).sort();

function statements(name: string) {
  return readFileSync(path.join(migrationDir, name, "migration.sql"), "utf8")
    .split("\n").filter((line) => !line.trim().startsWith("--")).join("\n")
    .split(/;[ \t]*(?:\r?\n|$)/).map((sql) => sql.trim()).filter(Boolean);
}

class IntentionalRollback<T> extends Error {
  constructor(readonly value: T) { super("scratch schema rollback"); }
}

async function scenario() {
  const prisma = getPrisma();
  const schema = `lab4_migration_${process.pid}_${Date.now()}`;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      for (const name of earlierMigrations) for (const sql of statements(name)) await tx.$executeRawUnsafe(sql);

      const stamp = "2026-10-13 09:00:00.000";
      await tx.$executeRawUnsafe(`INSERT INTO "Category" ("id","name","isActive","createdAt") VALUES (1,'Hardware',true,'${stamp}')`);
      await tx.$executeRawUnsafe(`INSERT INTO "RelatedSystem" ("id","name","isActive","createdAt") VALUES (1,'VPN',true,'${stamp}')`);
      await tx.$executeRawUnsafe(`INSERT INTO "User" ("id","name","email","passwordHash","role","isActive","mustChangePassword","createdAt","updatedAt") VALUES (1,'Requester','requester@migration.test','x','REQUESTER',true,false,'${stamp}','${stamp}'),(2,'Staff','staff@migration.test','x','IT_STAFF',true,false,'${stamp}','${stamp}')`);
      await tx.$executeRawUnsafe(`INSERT INTO "Requester" ("id","userId","name","email","isActive","createdAt") VALUES (1,1,'Requester','requester@migration.test',true,'${stamp}')`);
      await tx.$executeRawUnsafe(`INSERT INTO "Ticket" ("id","ticketNumber","requesterId","categoryId","relatedSystemId","summary","description","priority","currentStatus","itPriority","createdAt","updatedAt") VALUES (1,'MIG-001',1,1,1,'Keep this row','Existing Lab 3 data','HIGH','New','HIGH','${stamp}','${stamp}')`);

      const before = await tx.$queryRawUnsafe<Array<{ row: unknown }>>(`SELECT row_to_json(t) AS row FROM "Ticket" t ORDER BY "id"`);
      for (const sql of statements(lab4Migration)) await tx.$executeRawUnsafe(sql);
      const after = await tx.$queryRawUnsafe<Array<{ row: Record<string, unknown> }>>(`SELECT row_to_json(t) AS row FROM "Ticket" t ORDER BY "id"`);
      const columns = await tx.$queryRawUnsafe<Array<{ table_name: string; column_name: string; column_default: string | null }>>(
        `SELECT table_name, column_name, column_default FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('Ticket','ActionTaken','ActionTakenRevision') ORDER BY table_name, column_name`,
      );
      const indexes = await tx.$queryRawUnsafe<Array<{ indexdef: string }>>(`SELECT indexdef FROM pg_indexes WHERE schemaname = current_schema()`);

      await tx.$executeRawUnsafe(`INSERT INTO "ActionTaken" ("ticketId","performedById","description","updatedAt") VALUES (1,2,'Minimal action','${stamp}')`);
      const action = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM "ActionTaken"`);
      await tx.$executeRawUnsafe(`INSERT INTO "ActionTakenRevision" ("actionTakenId","revision","editedById","status","actionAt","description","result","followUpRequired","followUpNote","attachmentNotes") VALUES (1,1,2,'PLANNED','${stamp}','Minimal action','',false,'','')`);
      let duplicateRejected = false;
      try {
        await tx.$executeRawUnsafe(`INSERT INTO "ActionTakenRevision" ("actionTakenId","revision","editedById","status","actionAt","description","result","followUpRequired","followUpNote","attachmentNotes") VALUES (1,1,2,'PLANNED','${stamp}','Duplicate','',false,'','')`);
      } catch { duplicateRejected = true; }

      throw new IntentionalRollback({ before, after, columns, indexes, action, duplicateRejected });
    }, { timeout: 120_000 });
  } catch (error) {
    if (error instanceof IntentionalRollback) return error.value;
    throw error;
  }
  throw new Error("scratch scenario must roll back");
}

describe("Lab 4 additive migration", () => {
  let result: Awaited<ReturnType<typeof scenario>>;
  beforeAll(async () => { result = await scenario(); }, 180_000);

  it("replays the actual Lab 1-3 migration history before applying Lab 4", () => {
    expect(earlierMigrations.length).toBeGreaterThanOrEqual(7);
    expect(result.before).toHaveLength(1);
  });

  it("MIG-01: preserves existing ticket values and adds version 1 only", () => {
    const { version, ...existingValues } = result.after[0].row;
    expect(existingValues).toEqual(result.before[0].row);
    expect(version).toBe(1);
  });

  it("MIG-02: creates only the required tables, defaults and indexes", () => {
    expect(result.columns.some((column: { table_name: string; column_name: string; column_default: string | null }) => column.table_name === "Ticket" && column.column_name === "version" && column.column_default === "1")).toBe(true);
    expect(result.columns.filter((column: { table_name: string }) => column.table_name === "ActionTaken").length).toBeGreaterThan(10);
    expect(result.columns.filter((column: { table_name: string }) => column.table_name === "ActionTakenRevision").length).toBeGreaterThan(9);
    const definitions = result.indexes.map((index: { indexdef: string }) => index.indexdef).join("\n");
    expect(definitions).toMatch(/"ActionTaken" USING btree \("ticketId", "actionAt", id\)/);
    expect(definitions).toMatch(/"ActionTaken" USING btree \("assigneeId", status\)/);
    expect(definitions).toMatch(/"ActionTakenRevision" USING btree \("actionTakenId", revision\)/);
  });

  it("MIG-03: uses database defaults and prevents duplicate revision numbers", () => {
    expect(result.action[0]).toMatchObject({ status: "PLANNED", version: 1, result: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" });
    expect(result.duplicateRejected).toBe(true);
  });
});
