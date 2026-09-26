import { createHash, randomBytes } from "node:crypto";
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
const attempts = new Map<string, Attempt>();

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

function rateKey(req: Request, email: string) {
  return `${req.ip}|${email.toLowerCase()}`;
}

function isRateLimited(key: string, now = Date.now()) {
  const attempt = attempts.get(key);
  if (!attempt) return false;
  if (attempt.lockedUntil > now) return true;
  if (now - attempt.firstFailureAt > RATE_LIMIT_WINDOW_MS) attempts.delete(key);
  return false;
}

function recordFailure(key: string, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || now - current.firstFailureAt > RATE_LIMIT_WINDOW_MS) {
    attempts.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
    return;
  }
  current.failures += 1;
  if (current.failures >= MAX_FAILED_ATTEMPTS) current.lockedUntil = now + RATE_LIMIT_LOCK_MS;
}

function clearFailures(key: string) {
  attempts.delete(key);
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
  if (!req.auth || req.header("X-CSRF-Token") !== req.auth.csrfToken) {
    return authError(res, 403, "CSRF_MISMATCH", "A valid CSRF token is required.");
  }
  return next();
}

export async function login(req: Request, email: string, password: string) {
  const key = rateKey(req, email);
  if (isRateLimited(key)) return { kind: "invalid" as const };
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const valid = !!user && user.isActive && await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    recordFailure(key);
    return { kind: "invalid" as const };
  }
  clearFailures(key);
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

