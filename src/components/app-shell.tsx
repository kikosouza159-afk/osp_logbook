"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import type { SessionUser } from "@/lib/auth";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [collapsed,setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("osp_sidebar_collapsed") === "1");
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("osp_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  return <div className={`app-shell elite-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <div className="elite-ambient elite-ambient-a" aria-hidden="true"/>
    <div className="elite-ambient elite-ambient-b" aria-hidden="true"/>
    <Sidebar user={user} collapsed={collapsed} onToggle={toggleSidebar}/>
    <main className="main elite-main">
      <Header user={user}/>
      <div className="content elite-content" id="main-content">{children}</div>
    </main>
  </div>;
}
