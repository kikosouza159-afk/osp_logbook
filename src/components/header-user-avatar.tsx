"use client";

import { useState } from "react";

function initials(name:string) {
  return name.split(" ").filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("") || "U";
}

export function HeaderUserAvatar({ userId, name }: { userId:string; name:string }) {
  const [failed,setFailed]=useState(false);

  return <div className="header-avatar" aria-label={`Foto de ${name}`}>
    {!failed
      ? <img
          src={`/api/users/${userId}/photo?surface=header`}
          alt=""
          onError={()=>setFailed(true)}
        />
      : <span>{initials(name)}</span>}
  </div>;
}
