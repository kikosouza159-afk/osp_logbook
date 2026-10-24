import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const currentUser = await getSessionUser();
  if (currentUser?.role === "ANALYST" && currentUser.must_change_password) redirect("/change-password");
  if (currentUser?.role === "ANALYST" && !currentUser.tutorial_completed) redirect("/guide");
  if (currentUser) redirect("/");

  const params = await searchParams;

  return <main className="login-fullscreen">
    <div className="login-fullscreen-bg" aria-hidden="true"/>
    <div className="login-fullscreen-overlay" aria-hidden="true"/>
    <div className="login-fullscreen-grid" aria-hidden="true"/>
    <div className="login-fullscreen-scan" aria-hidden="true"/>

    <div className="login-particles" aria-hidden="true">
      <span/><span/><span/><span/><span/><span/><span/>
    </div>

    <header className="login-fullscreen-topbar">
      <img src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png" alt="OLOS"/>
      <span>OSP · Olos Strategy and Planning</span>
    </header>

    <section className="login-fullscreen-content">
      <div className="login-fullscreen-spacer"/>

      <div className="login-fullscreen-card-wrap">
        <div className="login-card-halo login-card-halo-a" aria-hidden="true"/>
        <div className="login-card-halo login-card-halo-b" aria-hidden="true"/>
        <img
          className="login-fullscreen-diagram"
          src="https://www.olos.com.br/wp-content/themes/olostech/assets/img/home/destaque.svg"
          alt=""
          aria-hidden="true"
        />

        <div className="login-card login-card-premium login-card-floating">
          <div className="login-card-kicker">Centro de controle</div>
          <h2>Bem-vindo</h2>
          <p>Acesse o centro de controle operacional.</p>
          <LoginForm hasError={params.error === "1"}/>
        </div>
      </div>
    </section>
  </main>;
}
