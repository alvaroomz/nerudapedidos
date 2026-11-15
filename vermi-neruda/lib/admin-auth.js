import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "vp_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  }
  return value;
}

function sign(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function isValidSession(token) {
  try {
    if (!token || typeof token !== "string") return false;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "admin" && Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function safeStringEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAdminRequest(request) {
  return isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
}
