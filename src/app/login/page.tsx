import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const currentUser = await getSessionUser();
  if (currentUser?.role === "ANALYST" && currentUser.must_change_password) redirect("/change-password");
  if (currentUser?.role === "ANALYST" && !currentUser.tutorial_completed) redirect("/guide");
  if (currentUser) redirect("/");

  const params = await searchParams;

  return <main className="login-page login-page-premium">
    <section className="login-visual login-visual-premium">
      <div className="login-hero-image" aria-hidden="true"/>
      <div className="login-hero-grid" aria-hidden="true"/>
      <div className="login-hero-glow login-hero-glow-a" aria-hidden="true"/>
      <div className="login-hero-glow login-hero-glow-b" aria-hidden="true"/>
      <div className="login-scan-line" aria-hidden="true"/>

      <div className="login-hero-brand">
        <img src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png" alt="OLOS"/>
        <span>OSP · Olos Strategy and Planning</span>
      </div>

      <div className="login-hero-copy">
        <span className="login-eyebrow">Diário de bordo operacional</span>
        <h1>OSP <span>LOGBOOK</span></h1>
        <p>Registre ocorrências, acompanhe tratativas e transforme cada incidente em histórico acionável.</p>
        <div className="login-hero-pills">
          <span>Registro</span>
          <span>Monitoramento</span>
          <span>Tratativa</span>
          <span>Histórico</span>
        </div>
      </div>
    </section>

    <section className="login-card-wrap login-card-wrap-premium">
      <div className="login-card-stage">
        <div className="login-card-halo login-card-halo-a" aria-hidden="true"/>
        <div className="login-card-halo login-card-halo-b" aria-hidden="true"/>
        <img
          className="login-card-diagram"
          src="https://www.olos.com.br/wp-content/themes/olostech/assets/img/home/destaque.svg"
          alt=""
          aria-hidden="true"
        />
        <div className="login-card login-card-premium">
          <div className="login-card-kicker">Centro de controle</div>
          <h2>Bem-vindo</h2>
          <p>Acesse o centro de controle operacional.</p>
          <LoginForm hasError={params.error === "1"}/>
        </div>
      </div>
    </section>
  </main>;
}
