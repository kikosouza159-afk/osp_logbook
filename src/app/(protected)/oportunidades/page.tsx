import { requireUser } from "@/lib/auth";
import { LocatorOpportunities } from "@/components/locator-opportunities";

export const metadata = { title: "Oportunidades Locator | OSP Logbook" };
export const dynamic = "force-dynamic";

export default async function OportunidadesPage() {
  await requireUser(["ADMIN"]);
  return <LocatorOpportunities />;
}
