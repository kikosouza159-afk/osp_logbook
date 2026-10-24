import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { query } from "@/lib/db";

export type AppRole = "ADMIN" | "ANALYST" | "VIEWER";
export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: AppRole;
  must_change_password: boolean;
  tutorial_completed: boolean;
};

const COOKIE_NAME = "osp_session";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET não configurado.");
  return new TextEncoder().encode(value || "osp-logbook-development-secret-change-me");
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    name: user.name,
    username: user.username,
    role: user.role,
    mustChangePassword: user.must_change_password,
    tutorialCompleted: user.tutorial_completed,
  })
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

const getSessionUserCached = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const result = await query<{
      id: string;
      name: string;
      username: string;
      role: AppRole;
      must_change_password: boolean;
      tutorial_completed: boolean;
    }>(
      "SELECT id, name, username, role, must_change_password, tutorial_completed FROM users WHERE id = $1 AND active = TRUE",
      [payload.sub]
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
});

export async function getSessionUser(): Promise<SessionUser | null> {
  return getSessionUserCached();
}

export async function requireUser(roles?: AppRole[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANALYST" && user.must_change_password) redirect("/change-password");
  if (user.role === "ANALYST" && !user.tutorial_completed) redirect("/guide");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}
