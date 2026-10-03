-- Replace the Lab 3 placeholder with a real bcrypt hash. The plaintext is
-- development-only and must be changed on first authenticated login.
UPDATE "User"
SET "passwordHash" = '$2b$12$S3DkgacMiIHJq/yy7MXN.eAwg0H.p0lYkZV8JvD4wCeWG62MVrBDW',
    "mustChangePassword" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "passwordHash" = 'LAB3_INITIAL_PASSWORD_MUST_CHANGE';
