"use client";

import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction } from "@/app/actions";

export function LoginForm({ hasError }: { hasError: boolean }) {
  const [show, setShow] = useState(false);
  return <form action={loginAction}>
    {hasError && <div className="login-error">Usuário ou senha inválidos.</div>}
    <div className="field"><label htmlFor="username">Usuário</label><input className="input" id="username" name="username" autoComplete="username" placeholder="Digite seu usuário" required/></div>
    <div className="field" style={{marginTop:14}}><label htmlFor="password">Senha</label><div className="password-wrap"><input className="input" id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" required/><button type="button" className="password-toggle" onClick={()=>setShow(v=>!v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>{show ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></div>
    <button className="btn btn-primary" style={{width:"100%",marginTop:20}} type="submit"><LogIn size={17}/> Entrar</button>
  </form>;
}
