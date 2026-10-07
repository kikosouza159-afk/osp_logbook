import { Search } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

export function Header({ user }: { user: SessionUser }) {
  return <header className="header">
    <div className="header-search"><Search size={17}/><form action="/incidents"><input name="q" placeholder="Pesquisar cliente, chamado ou incidente..." aria-label="Pesquisa global"/></form></div>
    <div className="header-user"><strong>{user.name}</strong><span>{user.role}</span></div>
  </header>;
}
