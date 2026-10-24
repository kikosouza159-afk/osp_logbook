import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, CheckCircle2, LayoutDashboard } from "lucide-react";
import { completeTutorialAction } from "@/app/actions";
import { getSessionUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANALYST" && user.must_change_password) redirect("/change-password");

  const tutorialPending = user.role === "ANALYST" && !user.tutorial_completed;

  return <div className="app-shell">
    <Sidebar user={user}/>
    <main className="main">
      <Header user={user}/>
      <div className="guide-panel-content">
        <section className={`guide-panel-toolbar ${tutorialPending ? "tutorial-mode" : ""}`}>
          <div className="guide-panel-heading">
            <span className="guide-panel-icon"><BookOpenCheck size={21}/></span>
            <div>
              <h1>{tutorialPending ? "Bem-vindo ao OSP Logbook" : "Guia de Uso"}</h1>
              <p>{tutorialPending
                ? "Este é seu tutorial de primeiro acesso. Percorra o guia e conclua para liberar o painel."
                : "Consulte o passo a passo sempre que precisar revisar um fluxo do painel."}</p>
            </div>
          </div>

          {tutorialPending
            ? <form action={completeTutorialAction}>
                <button className="btn btn-primary guide-finish-btn" type="submit">
                  <CheckCircle2 size={17}/> Concluir tutorial e acessar o painel <ArrowRight size={16}/>
                </button>
              </form>
            : <Link className="btn btn-secondary" href="/">
                <LayoutDashboard size={16}/> Voltar para Visão Geral
              </Link>}
        </section>

        {tutorialPending && <div className="guide-first-access-note">
          <span>1º acesso</span>
          <strong>Role o guia até o final para conhecer o fluxo recomendado.</strong>
          <small>Quando terminar, use o botão “Concluir tutorial e acessar o painel”.</small>
        </div>}

        <div className="guide-frame-shell">
          <iframe
            className="guide-frame"
            src="/guide/osp-logbook.html"
            title="Guia animado do OSP Logbook"
            loading="eager"
          />
        </div>
      </div>
    </main>
  </div>;
}
