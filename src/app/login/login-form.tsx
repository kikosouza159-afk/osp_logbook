"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  UserRound,
} from "lucide-react";

type LoginResponse = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
};

export function LoginForm({ hasError }: { hasError: boolean }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/");
  const [error, setError] = useState(
    hasError ? "Usuário ou senha inválidos. Verifique os dados e tente novamente." : ""
  );

  const finishTransition = () => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    router.replace(redirectTo);
    router.refresh();
  };

  useEffect(() => {
    if (!transitionVisible) return;

    router.prefetch(redirectTo);

    fallbackTimerRef.current = setTimeout(() => {
      finishTransition();
    }, 7000);

    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.volume = 1;

    const attemptPlay = async () => {
      try {
        await video.play();
      } catch {
        try {
          video.muted = true;
          await video.play();
        } catch {
          finishTransition();
        }
      }
    };

    void attemptPlay();

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [transitionVisible, redirectTo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || transitionVisible) return;

    setLoading(true);
    setError("");

    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");

    try {
      const response = await fetch("/api/auth/login-transition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ username, password }),
      });

      const result = (await response.json()) as LoginResponse;

      if (!response.ok || !result.ok) {
        setError(result.message || "Usuário ou senha inválidos.");
        setLoading(false);
        return;
      }

      const target = result.redirectTo || "/";
      setRedirectTo(target);
      router.prefetch(target);
      setTransitionVisible(true);
    } catch {
      setError("Falha de comunicação. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="login-form-modern">
        {error && <div className="login-error">{error}</div>}

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
              disabled={loading}
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
              disabled={loading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShow((value) => !value)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              disabled={loading}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          className="btn btn-primary login-submit"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <LoaderCircle className="login-submit-spinner" size={18} />
              Validando acesso...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Acessar painel
            </>
          )}
        </button>
      </form>

      {transitionVisible && (
        <div className="login-transition-overlay" aria-live="polite">
          <video
            ref={videoRef}
            className="login-transition-video"
            src="/login/osp-login-transition.mp4"
            preload="auto"
            playsInline
            onEnded={finishTransition}
            onError={finishTransition}
          />
          <div className="login-transition-shade" aria-hidden="true" />
          <div className="login-transition-status">
            <img
              src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png"
              alt="OLOS"
            />
            <div>
              <strong>Preparando o OSP</strong>
              <span>Carregando seu centro de controle...</span>
            </div>
            <LoaderCircle className="login-transition-spinner" size={22} />
          </div>
        </div>
      )}
    </>
  );
}
