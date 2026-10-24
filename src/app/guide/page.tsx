import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANALYST" && user.must_change_password) redirect("/change-password");

  const tutorialPending = user.role === "ANALYST" && !user.tutorial_completed;
  const src = tutorialPending ? "/guide/osp-logbook.html?first=1" : "/guide/osp-logbook.html";

  return <main className="guide-fullscreen-page">
    <iframe
      className="guide-fullscreen-frame"
      src={src}
      title="Guia animado do OSP Logbook"
      loading="eager"
    />
  </main>;
}
