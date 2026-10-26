"use client";

import { useState } from "react";

function initials(name:string) {
  return name.split(" ").filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("") || "U";
}

export function HeaderUserAvatar({
  userId,
  name,
  variant = "header",
}: {
  userId:string;
  name:string;
  variant?: "header" | "analyst-card";
}) {
  const [failed,setFailed]=useState(false);
  const className = variant === "analyst-card" ? "analyst-progress-avatar" : "header-avatar";

  return <div className={className} aria-label={`Foto de ${name}`}>
    {!failed
      ? <img
          src={`/api/users/${userId}/photo?surface=${variant}`}
          alt=""
          onError={()=>setFailed(true)}
        />
      : <span>{initials(name)}</span>}
  </div>;
}
