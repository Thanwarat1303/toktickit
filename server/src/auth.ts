import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import type { User, UserRole } from "@prisma/client";
import { getPrisma } from "./prisma.js";

export const SESSION_COOKIE = "toktickit_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_LOCK_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

type Attempt = { failures: number; firstFailureAt: number; lockedUntil: number };
const accountAttempts = new Map<string, Attempt>();
const ipAttempts = new Map<string, Attempt>();
const DUMMY_PASSWORD_HASH = "$2b$12$APutU5UyqjrAMrAOlhKun.NAwSoEG5YabyunTZI/JEEmJjZ56VXfy";

export function resetRateLimits() {
  accountAttempts.clear();
  ipAttempts.clear();
}

export type AuthenticatedRequest = Request & {
  auth?: { user: User; sessionId: number; csrfToken: string };
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

export function authError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

export function setSessionCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_MS / 1000}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`,
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`);
}

function cookieValue(req: Request) {
  const header = req.header("cookie") ?? "";
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return pair?.slice(SESSION_COOKIE.length + 1) || undefined;
}

function isRateLimited(store: Map<string, Attempt>, key: string, now = Date.now()) {
  const attempt = store.get(key);
  if (!attempt) return false;
  if (attempt.lockedUntil > now) return true;
  if (now - attempt.firstFailureAt > RATE_LIMIT_WINDOW_MS) store.delete(key);
  return false;
}

function recordFailure(store: Map<string, Attempt>, key: string, now = Date.now()) {
  const current = store.get(key);
  if (!current || now - current.firstFailureAt > RATE_LIMIT_WINDOW_MS) {
    store.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
    return;
  }
  current.failures += 1;
  if (current.failures >= MAX_FAILED_ATTEMPTS) current.lockedUntil = now + RATE_LIMIT_LOCK_MS;
}

function clearFailures(store: Map<string, Attempt>, key: string) {
  store.delete(key);
}

function secureEqual(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(userId: number) {
  const prisma = getPrisma();
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  const session = await prisma.session.create({ data: { userId, tokenHash: hashToken(token), csrfToken, expiresAt } });
  return { token, csrfToken, sessionId: session.id, expiresAt };
}

export async function loadAuth(req: Request) {
  const token = cookieValue(req);
  if (!token) return undefined;
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return undefined;
  }
  return { user: session.user, sessionId: session.id, csrfToken: session.csrfToken };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const auth = await loadAuth(req);
    if (!auth) return authError(res, 401, "UNAUTHENTICATED", "Authentication is required.");
    req.auth = auth;
    return next();
  } catch {
    return authError(res, 500, "AUTH_ERROR", "Unable to validate the session.");
  }
}

export function requireCsrf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth || !secureEqual(req.header("X-CSRF-Token"), req.auth.csrfToken)) {
    return authError(res, 403, "CSRF_MISMATCH", "A valid CSRF token is required.");
  }
  return next();
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  if (req.header("origin") !== expected) {
    return authError(res, 403, "ORIGIN_MISMATCH", "Request origin is not allowed.");
  }
  return next();
}

export async function login(req: Request, email: string, password: string) {
  const accountKey = email.toLowerCase();
  const ipKey = req.ip || "unknown";
  if (isRateLimited(accountAttempts, accountKey) || isRateLimited(ipAttempts, ipKey)) return { kind: "invalid" as const };
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const passwordHash = user?.isActive ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, passwordHash);
  const valid = !!user && user.isActive && passwordMatches;
  if (!valid) {
    recordFailure(accountAttempts, accountKey);
    recordFailure(ipAttempts, ipKey);
    return { kind: "invalid" as const };
  }
  clearFailures(accountAttempts, accountKey);
  clearFailures(ipAttempts, ipKey);
  const session = await createSession(user.id);
  return { kind: "success" as const, user, session };
}

export function publicUser(user: User) {
  return safeUser(user);
}

export function validRole(value: unknown): value is UserRole {
  return value === "REQUESTER" || value === "IT_STAFF" || value === "ADMINISTRATOR";
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
