import Link from "next/link";
import { CalendarRange, Settings, Wallet } from "lucide-react";

const tabs = [
  { id: "overview", href: "/financeiro", label: "Visão financeira", Icon: Wallet },
  { id: "tariffs", href: "/financeiro/tarifacao", label: "Tarifação mensal", Icon: CalendarRange },
  { id: "config", href: "/financeiro?aba=config", label: "Configurações de faturamento", Icon: Settings },
] as const;

export function FinancialNavigation({active}: {active: typeof tabs[number]["id"]}) {
  return <nav className="fi-config-nav fi-segment" aria-label="Visões do Financeiro">
    {tabs.map(({id, href, label, Icon}) =>
      <Link key={id} href={href} prefetch={false} scroll={false}
        aria-current={active === id ? "page" : undefined} className={active === id ? "active" : undefined}>
        <Icon size={15} aria-hidden="true"/>{label}
      </Link>
    )}
  </nav>;
}
