import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { query } from "@/lib/db";

export type AppRole = "ADMIN" | "ANALYST" | "VIEWER";
export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: AppRole;
};

const COOKIE_NAME = "osp_session";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET não configurado.");
  return new TextEncoder().encode(value || "osp-logbook-development-secret-change-me");
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const result = await query<{ id: string; name: string; username: string; role: AppRole }>(
      "SELECT id, name, username, role FROM users WHERE id = $1 AND active = TRUE",
      [payload.sub]
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(roles?: AppRole[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}
