import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, Plus, MoreHorizontal, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HomeOfficeAdvanceDialog } from "./HomeOfficeAdvanceDialog";
import { HomeOfficeRepaymentDialog } from "./HomeOfficeRepaymentDialog";
import { CasaMatrizStatementExport } from "./CasaMatrizStatementExport";

const fmtMoney = (n: number, c: string) =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

interface Props {
  highlightAdvId?: string | null;
  highlightRepId?: string | null;
  highlightAccId?: string | null;
  highlightFxrId?: string | null;
}

export function CasaMatrizView({
  highlightAdvId,
  highlightRepId,
  highlightAccId,
  highlightFxrId,
}: Props = {}) {
  const { user } = useAuth();
  const { selectedEntityId, requireEntity } = useEntity();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const role = user?.role;
  const canWrite = role === "admin" || role === "management" || role === "accountant";

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);
  const [pendingCapAccrualId, setPendingCapAccrualId] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const { rate: usdRate } = useExchangeRate(today);

  const { data: parties = [] } = useQuery({
    queryKey: ["home-office-parties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_office_parties")
        .select("id, name, currency, interest_rate_pct, interest_basis")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const party = parties[0];

  const { data: balance } = useQuery({
    queryKey: ["home-office-balance", party?.id, selectedEntityId],
    queryFn: async () => {
      let q = supabase.from("home_office_balance").select("*").eq("party_id", party!.id);
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!party?.id,
  });

  const { data: advances = [] } = useQuery({
    queryKey: ["home-office-advances", party?.id, selectedEntityId],
    queryFn: async () => {
      let q = supabase
        .from("home_office_advances")
        .select("id, advance_date, kind, currency, amount_fc, fx_rate, amount_dop, balance_remaining_fc, status, reference, description, journal_id")
        .eq("party_id", party!.id)
        .neq("status", "voided")
        .order("advance_date", { ascending: false })
        .limit(200);
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!party?.id,
  });

  const { data: repayments = [] } = useQuery({
    queryKey: ["home-office-repayments", party?.id, selectedEntityId],
    queryFn: async () => {
      let q = supabase
        .from("home_office_repayments")
        .select("id, repayment_date, currency, amount_fc, fx_rate, amount_dop, realized_fx_dop, status, reference, description, journal_id")
        .eq("party_id", party!.id)
        .neq("status", "voided")
        .order("repayment_date", { ascending: false })
        .limit(100);
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!party?.id,
  });

  const { data: accruals = [] } = useQuery({
    queryKey: ["home-office-accruals", party?.id, selectedEntityId],
    queryFn: async () => {
      let q = supabase
        .from("home_office_interest_accruals")
        .select("id, period_month, days, rate_pct, interest_fc, interest_dop, status, journal_id")
        .eq("party_id", party!.id)
        .order("period_month", { ascending: false })
        .limit(36);
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!party?.id,
  });

  const accrueNow = useMutation({
    mutationFn: async () => {
      const entityId = requireEntity();
      if (!entityId) throw new Error("Seleccione entidad.");
      const periodMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const { error } = await supabase.rpc("post_home_office_interest_accrual", {
        p_party_id: party!.id,
        p_entity_id: entityId,
        p_period_month: periodMonth,
        p_user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devengo de interés calculado.");
      qc.invalidateQueries({ queryKey: ["home-office-accruals"] });
      qc.invalidateQueries({ queryKey: ["home-office-balance"] });
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const capitalize = useMutation({
    mutationFn: async (accrualId: string) => {
      const { error } = await supabase.rpc("capitalize_interest_to_principal", {
        p_accrual_id: accrualId,
        p_user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Interés capitalizado al principal.");
      qc.invalidateQueries({ queryKey: ["home-office-accruals"] });
      qc.invalidateQueries({ queryKey: ["home-office-balance"] });
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  // Highlight + scroll
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  useEffect(() => {
    const id = highlightAdvId || highlightRepId || highlightAccId || highlightFxrId;
    if (!id) return;
    const el = rowRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightAdvId, highlightRepId, highlightAccId, highlightFxrId, advances, repayments, accruals]);

  if (!party) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">{t("ho.noParty")}</CardContent>
      </Card>
    );
  }

  const principalDop = Number(balance?.principal_dop || 0);
  const principalFc = Number(balance?.principal_fc || 0);
  const accruedDop = Number(balance?.accrued_interest_dop || 0);
  const todayValueDop = principalFc * Number(usdRate || 0);
  const unrealizedFx = usdRate ? todayValueDop - principalDop : null;

  const hl = (id: string, current: string | null | undefined) =>
    current === id ? "bg-yellow-50 dark:bg-yellow-950/20 ring-2 ring-yellow-400/60" : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {party.name} — {t("ho.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("ho.loanIn")} {party.currency} · {t("ho.interest")}{" "}
              {Number(party.interest_rate_pct).toFixed(2)}% ({party.interest_basis})
            </p>
          </div>
          <div className="flex gap-2">
            <CasaMatrizStatementExport
              partyName={party.name}
              currency={party.currency}
              advances={advances}
              repayments={repayments}
              accruals={accruals}
              principalFc={principalFc}
              principalDop={principalDop}
              accruedDop={accruedDop}
              unrealizedFx={unrealizedFx}
            />
            {canWrite && (
              <>
                <Button onClick={() => setAdvanceOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> {t("ho.newEntry")}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setRepayOpen(true)}>
                      {t("ho.recordRepayment")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => accrueNow.mutate()} disabled={accrueNow.isPending}>
                      {accrueNow.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-4 w-4" />
                      )}
                      {t("ho.accrueMonth")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Stat label={t("ho.principalFc").replace("{c}", party.currency)} value={fmtMoney(principalFc, party.currency)} />
            <Stat label={t("ho.principalDopHist")} value={fmtMoney(principalDop, "DOP")} />
            <Stat label={t("ho.accruedInterest")} value={fmtMoney(accruedDop, "DOP")} />
            <Stat
              label={t("ho.unrealizedFx")}
              value={unrealizedFx === null ? "—" : fmtMoney(unrealizedFx, "DOP")}
              tone={unrealizedFx === null ? "muted" : unrealizedFx >= 0 ? "neg" : "pos"}
              hint={usdRate ? `${t("ho.todayRate")} ${Number(usdRate).toFixed(4)}` : undefined}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("ho.advances")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("ho.kind")}</TableHead>
                <TableHead className="text-right">{t("ho.amountFc")}</TableHead>
                <TableHead className="text-right">{t("ho.rate")}</TableHead>
                <TableHead className="text-right">DOP</TableHead>
                <TableHead className="text-right">{t("ho.balanceFc")}</TableHead>
                <TableHead>Ref.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advances.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("ho.noMovements")}</TableCell></TableRow>
              )}
              {advances.map((a) => (
                <TableRow key={a.id} ref={(el) => { rowRefs.current[a.id] = el; }} className={hl(a.id, highlightAdvId)}>
                  <TableCell>{fmtDate(a.advance_date)}</TableCell>
                  <TableCell><Badge variant="outline">{a.kind}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(Number(a.amount_fc), a.currency)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(a.fx_rate).toFixed(4)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(Number(a.amount_dop), "DOP")}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(Number(a.balance_remaining_fc), a.currency)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.reference || a.description || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {repayments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("ho.repayments")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead className="text-right">{t("ho.amountFc")}</TableHead>
                  <TableHead className="text-right">{t("ho.rate")}</TableHead>
                  <TableHead className="text-right">DOP</TableHead>
                  <TableHead className="text-right">{t("ho.realizedFx")}</TableHead>
                  <TableHead>Ref.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.map((r) => (
                  <TableRow key={r.id} ref={(el) => { rowRefs.current[r.id] = el; }} className={hl(r.id, highlightRepId)}>
                    <TableCell>{fmtDate(r.repayment_date)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(Number(r.amount_fc), r.currency)}</TableCell>
                    <TableCell className="text-right font-mono">{Number(r.fx_rate).toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(Number(r.amount_dop), "DOP")}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(Number(r.realized_fx_dop), "DOP")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.reference || r.description || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("ho.accruals")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ho.month")}</TableHead>
                <TableHead className="text-right">{t("ho.days")}</TableHead>
                <TableHead className="text-right">{t("ho.ratePct")}</TableHead>
                <TableHead className="text-right">{t("ho.interestFc")}</TableHead>
                <TableHead className="text-right">{t("ho.interestDop")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accruals.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("ho.noAccruals")}</TableCell></TableRow>
              )}
              {accruals.map((a) => (
                <TableRow key={a.id} ref={(el) => { rowRefs.current[a.id] = el; }} className={hl(a.id, highlightAccId)}>
                  <TableCell>{format(new Date(a.period_month), "MMM yyyy")}</TableCell>
                  <TableCell className="text-right font-mono">{a.days}</TableCell>
                  <TableCell className="text-right font-mono">{Number(a.rate_pct).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(a.interest_fc).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(Number(a.interest_dop), "DOP")}</TableCell>
                  <TableCell><Badge variant={a.status === "accrued" ? "outline" : "secondary"}>{a.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canWrite && a.status === "accrued" && (
                      <Button size="sm" variant="outline" onClick={() => setPendingCapAccrualId(a.id)} disabled={capitalize.isPending}>
                        {t("ho.capitalize")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {highlightFxrId && (
            <p className="text-xs text-muted-foreground mt-3">
              FX reval id: <span className="font-mono">{highlightFxrId}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <HomeOfficeAdvanceDialog open={advanceOpen} onOpenChange={setAdvanceOpen} partyId={party.id} partyCurrency={party.currency} />
      <HomeOfficeRepaymentDialog open={repayOpen} onOpenChange={setRepayOpen} partyId={party.id} partyCurrency={party.currency} />

      <AlertDialog open={!!pendingCapAccrualId} onOpenChange={(v) => { if (!v) setPendingCapAccrualId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ho.capitalizeWarning.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("ho.capitalizeWarning.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("ho.capitalizeWarning.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingCapAccrualId) {
                capitalize.mutate(pendingCapAccrualId);
                setPendingCapAccrualId(null);
              }
            }}>
              {t("ho.capitalizeWarning.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: "pos" | "neg" | "muted"; hint?: string }) {
  const color =
    tone === "pos" ? "text-emerald-600" :
    tone === "neg" ? "text-destructive" :
    tone === "muted" ? "text-muted-foreground" : "";
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`mt-1 font-mono text-lg ${color}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
