"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardCheck, BookOpenCheck, Siren, MessageSquareText, Building2, Users, History, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { SessionUser } from "@/lib/auth";

const items = [
  ["/", "Visão Geral", LayoutDashboard],
  ["/guide", "Guia de Uso", BookOpenCheck],
  ["/checklist", "Checklist", ClipboardCheck],
  ["/incidents", "Incidentes", Siren],
  ["/responses", "Respostas", MessageSquareText],
  ["/clients", "Clientes", Building2],
  ["/analysts", "Analistas", Users],
  ["/history", "Histórico", History],
  ["/settings", "Configurações", Settings],
] as const;

export function Sidebar({ user, collapsed, onToggle }: { user: SessionUser; collapsed:boolean; onToggle:()=>void }) {
  const pathname = usePathname();
  return <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="side-logo">
      <img src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png" alt="OLOS"/>
      <div className="side-brand"><div className="side-title">OSP LOGBOOK</div></div>
      <button
        className="sidebar-toggle"
        type="button"
        onClick={onToggle}
        title={collapsed ? "Expandir menu" : "Ocultar menu"}
        aria-label={collapsed ? "Expandir menu lateral" : "Ocultar menu lateral"}
      >
        {collapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}
      </button>
    </div>
    <nav className="nav">{items.map(([href,label,Icon]) => {
      const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
      return <Link prefetch={false} className={`nav-link ${active ? "active" : ""}`} href={href} key={href}><Icon size={18}/><span className="nav-label">{label}</span></Link>;
    })}</nav>
    <div className="side-footer"><div className="side-user"><strong>{user.name}</strong><span>@{user.username}</span></div><form action={logoutAction}><button className="btn btn-ghost" type="submit"><LogOut size={16}/><span className="logout-label">Sair</span></button></form></div>
  </aside>;
}
