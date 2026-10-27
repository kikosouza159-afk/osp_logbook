import { Activity, CalendarDays, Search, Sparkles } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { HeaderUserAvatar } from "@/components/header-user-avatar";
import { ThemeToggle } from "@/components/theme-toggle";

function currentDateLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone:"America/Sao_Paulo",
    weekday:"short",
    day:"2-digit",
    month:"short",
  }).format(new Date()).replace(".","");
}

export function Header({ user }: { user: SessionUser }) {
  return <header className="header elite-header">
    <div className="elite-header-context">
      <span className="elite-header-kicker"><Sparkles size={13}/> OSP Command Center</span>
      <strong>Operações & Estratégia</strong>
    </div>

    <div className="header-search elite-search">
      <Search size={17}/>
      <form action="/incidents">
        <input name="q" placeholder="Pesquisar cliente, chamado ou incidente..." aria-label="Pesquisa global"/>
      </form>
      <span className="elite-search-hint">GLOBAL</span>
    </div>

    <div className="header-actions elite-header-actions">
      <div className="elite-date-chip" title="Data operacional em São Paulo">
        <CalendarDays size={14}/>
        <span>{currentDateLabel()}</span>
      </div>
      <div className="elite-system-chip">
        <span className="elite-live-dot"/>
        <Activity size={13}/>
        <span>Online</span>
      </div>
      <ThemeToggle/>
      <div className="header-profile elite-profile">
        <HeaderUserAvatar userId={user.id} name={user.name}/>
        <div className="header-user">
          <strong>{user.name}</strong>
          <span>{user.role}</span>
        </div>
      </div>
    </div>
  </header>;
}
