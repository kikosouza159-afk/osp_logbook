import { requireUser } from "@/lib/auth";
import { FinancialCenter } from "@/components/financial-center";
export const metadata = {title:"Financeiro | OSP Logbook"};
export default async function FinanceiroPage({searchParams}: {searchParams: Promise<{aba?: string}>}){
  await requireUser(["ADMIN"]);
  return <FinancialCenter view={(await searchParams).aba === "config" ? "config" : "overview"}/>;
}
