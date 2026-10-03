-- The Prisma @unique constraint is case-sensitive in PostgreSQL.  Keep it for
-- foreign-key tooling, and add this expression index as the database-level
-- source of truth for BR-14 under concurrent requests.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" ((LOWER("email")));
