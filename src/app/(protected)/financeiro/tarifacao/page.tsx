import { FinancialNavigation } from "@/components/financial-navigation";
import { FinancialTariffs } from "@/components/financial-tariffs";
import { requireUser } from "@/lib/auth";
import { getTariffReport } from "@/lib/financial-tariff-query";
import "@/components/financial-center.css";

export const metadata = {title: "Tarifação mensal | OSP Logbook"};

export default async function TariffPage({searchParams}: {searchParams: Promise<{ano?: string}>}) {
  await requireUser(["ADMIN"]);
  const {ano} = await searchParams;
  const report = await getTariffReport(ano).catch(() => null);
  return <div className="fi tariff-page">
    <div className="page-head fi-head">
      <div><small className="fi-eyebrow">GESTÃO / FINANCEIRO</small><h1>Tarifação mensal</h1></div>
    </div>
    <FinancialNavigation active="tariffs"/>
    <FinancialTariffs key={report?.year} report={report}/>
  </div>;
}
