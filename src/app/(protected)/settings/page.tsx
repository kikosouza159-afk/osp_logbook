import { Database, Github, Server, ShieldCheck } from "lucide-react";

export default function SettingsPage(){
  const items=[
    ["Banco de dados","Neon PostgreSQL","Conexão via DATABASE_URL",Database],
    ["Repositório","kikosouza159-afk/osp_logbook","Branch principal: main",Github],
    ["Hospedagem","Render","Health check: /api/health",Server],
    ["Segurança","Sessão HttpOnly","Senha armazenada com bcrypt",ShieldCheck],
  ] as const;
  return <><div className="page-head"><div><h1>Configurações</h1><p>Informações do ambiente e arquitetura da aplicação.</p></div></div><div className="grid-kpi">{items.map(([title,value,sub,Icon])=><div className="card kpi" key={title}><div className="kpi-top"><span>{title}</span><span className="kpi-icon"><Icon size={18}/></span></div><div style={{marginTop:14,fontWeight:800,color:"var(--navy)"}}>{value}</div><div style={{marginTop:5,fontSize:12,color:"#7A7F8D"}}>{sub}</div></div>)}</div><section className="card panel" style={{marginTop:18}}><div className="panel-title"><h2>Próximas evoluções</h2></div><p style={{color:"#686E7C",lineHeight:1.7}}>A arquitetura está preparada para anexos, SLA, notificações, webhooks, integrações com chamados, relatórios diários e classificação assistida por IA sem transformar o projeto em um novelo de macarrão tecnológico.</p></section></>;
}
