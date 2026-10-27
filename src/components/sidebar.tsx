"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardCheck, BookOpenCheck, Siren, MessageSquareText, Building2,
  Users, History, Settings, LogOut, PanelLeftClose, PanelLeftOpen, Sparkles, ShieldCheck
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { SessionUser } from "@/lib/auth";

const groups = [
  {
    label:"Monitoramento",
    items:[
      ["/", "Visão Geral", LayoutDashboard],
      ["/checklist", "Checklist", ClipboardCheck],
      ["/incidents", "Incidentes", Siren],
      ["/responses", "Respostas", MessageSquareText],
    ],
  },
  {
    label:"Gestão",
    items:[
      ["/clients", "Clientes", Building2],
      ["/analysts", "Analistas", Users],
    ],
  },
  {
    label:"Governança",
    items:[
      ["/history", "Histórico", History],
      ["/guide", "Guia de Uso", BookOpenCheck],
      ["/settings", "Configurações", Settings],
    ],
  },
] as const;

export function Sidebar({ user, collapsed, onToggle }: { user: SessionUser; collapsed:boolean; onToggle:()=>void }) {
  const pathname = usePathname();

  return <aside className={`sidebar elite-sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="side-logo elite-brand">
      <div className="elite-brand-mark">
        <img src="https://www.olos.com.br/wp-content/uploads/2022/12/logo-olos-laranja.png" alt="OLOS"/>
      </div>
      <div className="side-brand elite-brand-copy">
        <div className="side-title">OSP LOGBOOK</div>
        <span>Operations Intelligence</span>
      </div>
      <button
        className="sidebar-toggle"
        type="button"
        onClick={onToggle}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      >
        {collapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}
      </button>
    </div>

    <div className="elite-side-status">
      <span className="elite-live-dot"/>
      <div><strong>Control Center</strong><small>Operação online</small></div>
      <Sparkles size={14}/>
    </div>

    <nav className="nav elite-nav" aria-label="Navegação principal">
      {groups.map(group=><div className="elite-nav-group" key={group.label}>
        <span className="elite-nav-label">{group.label}</span>
        <div className="elite-nav-items">
          {group.items.map(([href,label,Icon]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link
              prefetch={false}
              className={`nav-link ${active ? "active" : ""}`}
              href={href}
              key={href}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
            >
              <span className="elite-nav-icon"><Icon size={18}/></span>
              <span className="nav-label">{label}</span>
              {active && <span className="elite-nav-active-dot" aria-hidden="true"/>}
            </Link>;
          })}
        </div>
      </div>)}
    </nav>

    <div className="side-footer elite-side-footer">
      <div className="elite-user-card">
        <div className="elite-user-orb">{user.name.slice(0,1).toUpperCase()}</div>
        <div className="side-user">
          <strong>{user.name}</strong>
          <span>@{user.username}</span>
        </div>
        <span className="elite-role-pill"><ShieldCheck size={11}/>{user.role}</span>
      </div>
      <form action={logoutAction}>
        <button className="btn btn-ghost elite-logout" type="submit"><LogOut size={16}/><span className="logout-label">Encerrar sessão</span></button>
      </form>
    </div>
  </aside>;
}
