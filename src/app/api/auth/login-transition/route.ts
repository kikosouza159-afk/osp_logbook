import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

type LoginUser = {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
  active: boolean;
  must_change_password: boolean;
  tutorial_completed: boolean;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Informe usuário e senha." },
        { status: 400 }
      );
    }

    const result = await query<LoginUser>(
      `SELECT
         id,
         name,
         username,
         password_hash,
         role,
         active,
         must_change_password,
         tutorial_completed
       FROM users
       WHERE username=$1
       LIMIT 1`,
      [parsed.data.username]
    );

    const user = result.rows[0];
    const validPassword =
      user?.active &&
      (await bcrypt.compare(parsed.data.password, user.password_hash));

    if (!user || !validPassword) {
      return NextResponse.json(
        { ok: false, message: "Usuário ou senha inválidos." },
        { status: 401 }
      );
    }

    await createSession({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      must_change_password: user.must_change_password,
      tutorial_completed: user.tutorial_completed,
    });

    await query("UPDATE users SET last_login_at=NOW() WHERE id=$1", [user.id]);
    await audit(user.id, "LOGIN", "session", user.id, {
      source: "login_transition",
    });

    let redirectTo = "/";
    if (user.role === "ANALYST" && user.must_change_password) {
      redirectTo = "/change-password";
    } else if (user.role === "ANALYST" && !user.tutorial_completed) {
      redirectTo = "/guide";
    }

    return NextResponse.json({
      ok: true,
      redirectTo,
    });
  } catch (error) {
    console.error("LOGIN_TRANSITION_ERROR", error);
    return NextResponse.json(
      { ok: false, message: "Não foi possível acessar o painel agora." },
      { status: 500 }
    );
  }
}
