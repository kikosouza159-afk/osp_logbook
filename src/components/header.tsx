import { Search } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { HeaderUserAvatar } from "@/components/header-user-avatar";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header({ user }: { user: SessionUser }) {
  return <header className="header">
    <div className="header-search">
      <Search size={17}/>
      <form action="/incidents">
        <input name="q" placeholder="Pesquisar cliente, chamado ou incidente..." aria-label="Pesquisa global"/>
      </form>
    </div>

    <div className="header-actions">
      <ThemeToggle/>
      <div className="header-profile">
        <HeaderUserAvatar userId={user.id} name={user.name}/>
        <div className="header-user">
          <strong>{user.name}</strong>
          <span>{user.role}</span>
        </div>
      </div>
    </div>
  </header>;
}
