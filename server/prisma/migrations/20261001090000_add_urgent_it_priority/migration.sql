-- IT Staff may raise an operational priority to Urgent. Requester-facing
-- ticket creation remains restricted by application validation to Low/Medium/High.
ALTER TYPE "Priority" ADD VALUE IF NOT EXISTS 'URGENT';
