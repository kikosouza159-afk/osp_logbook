import { redirect } from "next/navigation";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { changeFirstPasswordAction, logoutAction } from "@/app/actions";
import { getSessionUser } from "@/lib/auth";

const errors: Record<string,string> = {
  length: "A nova senha deve ter pelo menos 8 caracteres.",
  match: "As senhas informadas não são iguais.",
  default: "Escolha uma senha diferente da senha inicial.",
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ANALYST" || !user.must_change_password) redirect("/");

  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;

  return <main className="login-page first-access-page">
    <section className="login-visual">
      <div className="orbit-dot"/>
      <div className="login-copy">
        <img src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png" alt="OLOS"/>
        <h1>PRIMEIRO <span>ACESSO</span></h1>
        <p>Antes de entrar no OSP Logbook, defina sua senha pessoal. Essa etapa acontece somente no primeiro acesso.</p>
      </div>
    </section>

    <section className="login-card-wrap">
      <div className="login-card first-access-card">
        <div className="first-access-icon"><ShieldCheck size={24}/></div>
        <h2>Crie sua nova senha</h2>
        <p>Olá, {user.name.split(" ")[0]}. Sua senha inicial precisa ser substituída para liberar o painel.</p>

        {error && <div className="login-error">{error}</div>}

        <form action={changeFirstPasswordAction}>
          <div className="field">
            <label htmlFor="new_password">Nova senha</label>
            <div className="password-wrap">
              <input
                className="input"
                id="new_password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="Mínimo de 8 caracteres"
                required
              />
              <span className="password-field-icon"><KeyRound size={17}/></span>
            </div>
          </div>

          <div className="field" style={{marginTop:14}}>
            <label htmlFor="confirm_password">Confirmar nova senha</label>
            <input
              className="input"
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Digite novamente"
              required
            />
          </div>

          <div className="password-policy">
            <strong>Regras do primeiro acesso</strong>
            <span>• mínimo de 8 caracteres</span>
            <span>• não pode repetir a senha inicial</span>
            <span>• após salvar, o acesso ao painel é liberado</span>
          </div>

          <button className="btn btn-primary" style={{width:"100%",marginTop:18}} type="submit">
            <ShieldCheck size={17}/> Salvar nova senha e acessar
          </button>
        </form>

        <form action={logoutAction}>
          <button className="btn btn-secondary" style={{width:"100%",marginTop:10}} type="submit">
            <LogOut size={16}/> Sair
          </button>
        </form>
      </div>
    </section>
  </main>;
}
