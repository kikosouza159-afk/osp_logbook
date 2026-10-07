"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Siren, MessageSquareText, Building2, Users, History, Settings, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { SessionUser } from "@/lib/auth";

const items = [
  ["/", "Visão Geral", LayoutDashboard],
  ["/logbook", "Diário de Bordo", BookOpen],
  ["/incidents", "Incidentes", Siren],
  ["/responses", "Respostas", MessageSquareText],
  ["/clients", "Clientes", Building2],
  ["/analysts", "Analistas", Users],
  ["/history", "Histórico", History],
  ["/settings", "Configurações", Settings],
] as const;

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  return <aside className="sidebar">
    <div className="side-logo"><img src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png" alt="OLOS"/><div><div className="side-title">OSP LOGBOOK</div></div></div>
    <nav className="nav">{items.map(([href,label,Icon]) => {
      const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
      return <Link className={`nav-link ${active ? "active" : ""}`} href={href} key={href}><Icon size={18}/><span>{label}</span></Link>;
    })}</nav>
    <div className="side-footer"><div className="side-user"><strong>{user.name}</strong><span>@{user.username}</span></div><form action={logoutAction}><button className="btn btn-ghost" type="submit"><LogOut size={16}/> Sair</button></form></div>
  </aside>;
}
