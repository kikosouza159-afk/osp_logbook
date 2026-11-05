import { redirect } from "next/navigation";
import { ShieldCheck, Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const currentUser = await getSessionUser();
  if (currentUser?.role === "ANALYST" && currentUser.must_change_password) redirect("/change-password");
  if (currentUser?.role === "ANALYST" && !currentUser.tutorial_completed) redirect("/guide");
  if (currentUser) redirect("/");

  const params = await searchParams;

  return (
    <main className="login-fullscreen">
      <div className="login-fullscreen-bg" aria-hidden="true" />
      <div className="login-fullscreen-overlay" aria-hidden="true" />
      <div className="login-christmas-glow login-christmas-glow-a" aria-hidden="true" />
      <div className="login-christmas-glow login-christmas-glow-b" aria-hidden="true" />

      <div className="login-particles login-snow" aria-hidden="true">
        <span/><span/><span/><span/><span/><span/><span/>
        <span/><span/><span/><span/><span/>
      </div>

      <header className="login-fullscreen-topbar">
        <img
          src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png"
          alt="OLOS"
        />
        <span>OSP · Olos Strategy and Planning</span>
      </header>

      <section className="login-fullscreen-content">
        <div className="login-fullscreen-spacer" />

        <div className="login-fullscreen-card-wrap login-christmas-card-wrap">
          <div className="login-card-orbit login-card-orbit-a" aria-hidden="true" />
          <div className="login-card-orbit login-card-orbit-b" aria-hidden="true" />

          <div className="login-card login-card-premium login-card-floating login-card-christmas">
            <div className="login-card-topline">
              <div className="login-card-kicker">
                <Sparkles size={14} />
                OSP Command Center
              </div>
              <div className="login-secure-pill">
                <span />
                Seguro
              </div>
            </div>

            <div className="login-card-icon">
              <ShieldCheck size={24} />
            </div>

            <h2>Bem-vindo ao OSP</h2>
            <p>Entre para acessar o centro de controle operacional, indicadores e monitoramento.</p>

            <LoginForm hasError={params.error === "1"} />

            <div className="login-card-footer">
              <span>OLOS Strategy &amp; Planning</span>
              <span className="login-card-footer-dot" />
              <span>Ambiente corporativo</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
