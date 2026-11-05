"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, LogIn, UserRound } from "lucide-react";
import { loginAction } from "@/app/actions";

export function LoginForm({ hasError }: { hasError: boolean }) {
  const [show, setShow] = useState(false);

  return (
    <form action={loginAction} className="login-form-modern">
      {hasError && (
        <div className="login-error">
          Usuário ou senha inválidos. Verifique os dados e tente novamente.
        </div>
      )}

      <div className="field">
        <label htmlFor="username">Usuário</label>
        <div className="login-input-shell">
          <UserRound size={18} aria-hidden="true" />
          <input
            className="input"
            id="username"
            name="username"
            autoComplete="username"
            placeholder="Digite seu usuário"
            required
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="password">Senha</label>
        <div className="password-wrap login-input-shell">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            className="input"
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShow((value) => !value)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <button className="btn btn-primary login-submit" type="submit">
        <LogIn size={18} />
        Acessar painel
      </button>
    </form>
  );
}
