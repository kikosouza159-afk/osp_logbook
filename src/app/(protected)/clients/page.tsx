import { Building2, Plus } from "lucide-react";
import { createClientAction } from "@/app/actions";
import { getClients, getProducts } from "@/lib/queries";

export default async function ClientsPage(){
  const [clients,products]=await Promise.all([getClients(),getProducts()]);
  return <><div className="page-head"><div><h1>Clientes</h1><p>Cadastre clientes e associe os produtos atendidos.</p></div></div>
  <div className="grid-2"><section className="card form-card"><h2 className="section-title" style={{marginTop:0}}>Novo cliente</h2><form action={createClientAction}><div className="field"><label>Nome legal/interno</label><input className="input" name="name" required/></div><div className="field" style={{marginTop:12}}><label>Nome de exibição</label><input className="input" name="display_name" required/></div><div className="field" style={{marginTop:12}}><label>Produtos</label><div className="checks">{products.map(p=><label className="check" key={p.id}><input type="checkbox" name="products" value={p.code}/>{p.name}</label>)}</div></div><button className="btn btn-primary" style={{marginTop:18}}><Plus size={16}/> Cadastrar cliente</button></form></section>
  <section className="card panel"><div className="panel-title"><h2>Clientes ativos</h2><span className="badge">{clients.length}</span></div>{clients.length?<div className="timeline">{clients.map(c=><div className="timeline-item" key={c.id}><strong>{c.display_name}</strong><span>{c.products||"Sem produto associado"} · {c.active?"Ativo":"Inativo"}</span></div>)}</div>:<div className="empty"><Building2 size={28}/><strong>Nenhum cliente cadastrado</strong>Cadastre o primeiro cliente para abrir incidentes.</div>}</section></div></>;
}
