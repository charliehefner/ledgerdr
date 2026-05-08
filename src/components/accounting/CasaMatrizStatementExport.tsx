import { format } from "date-fns";
import { ExportDropdown } from "@/components/analytics/ExportDropdown";
import type { ExportData, ExportConfig } from "@/hooks/useExport";

interface Row {
  date: string;
  type: string;
  ref: string;
  amount_fc: number;
  fx_rate: number;
  amount_dop: number;
  realized_fx_dop: number;
  balance_fc: number;
}

interface Props {
  partyName: string;
  currency: string;
  advances: any[];
  repayments: any[];
  accruals: any[];
  principalFc: number;
  principalDop: number;
  accruedDop: number;
  unrealizedFx: number | null;
}

export function CasaMatrizStatementExport({
  partyName,
  currency,
  advances,
  repayments,
  accruals,
  principalFc,
  principalDop,
  accruedDop,
  unrealizedFx,
}: Props) {
  const buildData = (): ExportData => {
    const rows: Row[] = [];
    advances.forEach((a) =>
      rows.push({
        date: a.advance_date,
        type: `Aporte (${a.kind})`,
        ref: a.reference || a.description || "",
        amount_fc: Number(a.amount_fc),
        fx_rate: Number(a.fx_rate),
        amount_dop: Number(a.amount_dop),
        realized_fx_dop: 0,
        balance_fc: Number(a.balance_remaining_fc),
      })
    );
    repayments.forEach((r) =>
      rows.push({
        date: r.repayment_date,
        type: "Repago",
        ref: r.reference || r.description || "",
        amount_fc: -Number(r.amount_fc),
        fx_rate: Number(r.fx_rate),
        amount_dop: -Number(r.amount_dop),
        realized_fx_dop: Number(r.realized_fx_dop || 0),
        balance_fc: 0,
      })
    );
    accruals.forEach((ac) =>
      rows.push({
        date: format(new Date(ac.period_month), "yyyy-MM-dd"),
        type: `Devengo (${ac.status})`,
        ref: format(new Date(ac.period_month), "yyyy-MM"),
        amount_fc: Number(ac.interest_fc || 0),
        fx_rate: 0,
        amount_dop: Number(ac.interest_dop),
        realized_fx_dop: 0,
        balance_fc: 0,
      })
    );

    rows.sort((a, b) => a.date.localeCompare(b.date));

    const fmtNum = (n: number) =>
      n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const exportRows = rows.map((r) => ({
      date: format(new Date(r.date), "dd MMM yyyy"),
      type: r.type,
      ref: r.ref,
      amount_fc: r.amount_fc !== 0 ? fmtNum(r.amount_fc) : "-",
      fx_rate: r.fx_rate ? r.fx_rate.toFixed(4) : "-",
      amount_dop: fmtNum(r.amount_dop),
      realized_fx_dop: r.realized_fx_dop !== 0 ? fmtNum(r.realized_fx_dop) : "-",
      balance_fc: r.balance_fc !== 0 ? fmtNum(r.balance_fc) : "-",
    }));

    return {
      columns: [
        { key: "date", header: "Fecha", width: 14 },
        { key: "type", header: "Tipo", width: 22 },
        { key: "ref", header: "Referencia", width: 24 },
        { key: "amount_fc", header: `Monto ${currency}`, width: 16 },
        { key: "fx_rate", header: "Tasa", width: 10 },
        { key: "amount_dop", header: "Monto DOP", width: 16 },
        { key: "realized_fx_dop", header: "FX realizado", width: 14 },
        { key: "balance_fc", header: `Saldo ${currency}`, width: 16 },
      ],
      rows: exportRows,
      totalsRow: {
        date: "TOTALES",
        type: "",
        ref: "",
        amount_fc: `Principal: ${fmtNum(principalFc)} ${currency}`,
        fx_rate: "",
        amount_dop: `Principal DOP: ${fmtNum(principalDop)} · Devengado: ${fmtNum(
          accruedDop
        )}${unrealizedFx !== null ? ` · FX no real.: ${fmtNum(unrealizedFx)}` : ""}`,
        realized_fx_dop: "",
        balance_fc: "",
      },
    };
  };

  const config: ExportConfig = {
    filename: `casa-matriz-${partyName.replace(/\s+/g, "-")}`,
    title: `Casa Matriz — ${partyName}`,
    subtitle: `Estado de cuenta · Moneda ${currency}`,
    orientation: "landscape",
    fontSize: 8,
  };

  return <ExportDropdown getData={buildData} config={config} />;
}
