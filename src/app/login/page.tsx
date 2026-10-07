import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const params = await searchParams;
  return <main className="login-page">
    <section className="login-visual">
      <div className="orbit-dot"/>
      <div className="login-copy">
        <img src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png" alt="OLOS"/>
        <h1>OSP <span>LOGBOOK</span></h1>
        <p>Diário de bordo operacional para registrar, acompanhar e transformar incidentes de Locator e ADA em histórico acionável.</p>
      </div>
    </section>
    <section className="login-card-wrap"><div className="login-card"><h2>Bem-vindo</h2><p>Acesse o centro de controle operacional.</p><LoginForm hasError={params.error === "1"}/><div className="login-hint">Primeiro acesso: <code>admin</code> / <code>admin123</code>. Altere a credencial após validar o ambiente.</div></div></section>
  </main>;
}
