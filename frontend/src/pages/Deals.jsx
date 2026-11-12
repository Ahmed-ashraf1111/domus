import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Handshake, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import client from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const ALL = "all";
const NONE = "none";
const PAGE_SIZE = 10;

const STAGES = ["offer", "negotiation", "booking", "closed_won", "closed_lost"];
const CLOSED_STAGES = ["closed_won", "closed_lost"];

// badge colors for each deal stage
const STAGE_STYLES = {
  offer: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  negotiation:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  booking:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  closed_won:
    "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  closed_lost: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

const EMPTY_FORM = {
  property_id: "",
  lead_id: NONE,
  agent_id: "",
  offer_amount: "",
  expected_close_date: "",
  notes: "",
};

const EMPTY_EDIT = {
  offer_amount: "",
  agreed_amount: "",
  expected_close_date: "",
  notes: "",
};

function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function formatDate(value, locale) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Deals() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stage, setStage] = useState(ALL);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);

  // admin override confirmation
  const [override, setOverride] = useState(null);

  // edit dialog
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // create dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState([]);
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    const params = { page, limit: PAGE_SIZE };
    if (stage !== ALL) params.stage = stage;

    setLoading(true);
    setError(false);
    client
      .get("/deals", { params })
      .then((res) => {
        setItems(res.data.data);
        setMeta({
          total: res.data.total,
          page: res.data.page,
          pages: res.data.pages,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [stage, page, reloadKey]);

  // load the lists used by the dialog the first time it opens
  const openDialog = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(true);

    if (properties.length === 0) {
      client
        .get("/properties", { params: { limit: 50 } })
        .then((res) => setProperties(res.data.data))
        .catch(() => setProperties([]));
    }
    if (leads.length === 0) {
      client
        .get("/leads", { params: { limit: 100 } })
        .then((res) => setLeads(res.data.data))
        .catch(() => setLeads([]));
    }
    if (isAdmin && agents.length === 0) {
      client
        .get("/users/agents")
        .then((res) => setAgents(res.data))
        .catch(() => setAgents([]));
    }
  };

  const setField = (name) => (valueOrEvent) => {
    const value = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (!form.property_id) found.property_id = t("deals.required");
    if (
      form.offer_amount !== "" &&
      (isNaN(Number(form.offer_amount)) || Number(form.offer_amount) < 0)
    ) {
      found.offer_amount = t("deals.invalidAmount");
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const payload = {
      property_id: Number(form.property_id),
      offer_amount: form.offer_amount,
      expected_close_date: form.expected_close_date,
      notes: form.notes.trim(),
    };
    if (form.lead_id !== NONE) payload.lead_id = Number(form.lead_id);
    if (isAdmin && form.agent_id) payload.agent_id = Number(form.agent_id);

    setSaving(true);
    try {
      await client.post("/deals", payload);
      toast.success(t("deals.created"));
      setOpen(false);
      setPage(1);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || t("deals.createError"));
    } finally {
      setSaving(false);
    }
  };

  const changeStage = async (id, next, force = false) => {
    setUpdatingId(id);
    try {
      const body = { stage: next };
      if (force) body.override = true;
      await client.patch(`/deals/${id}/stage`, body);
      toast.success(t("deals.stageUpdated"));
      setReloadKey((k) => k + 1);
    } catch (err) {
      const message = err.response?.data?.message || t("deals.updateError");
      // the admin can override the "one booking per property" rule
      if (err.response?.status === 409 && isAdmin && !force && message.includes("already booked")) {
        setOverride({ id, stage: next });
      } else {
        toast.error(message);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const openEdit = (d) => {
    setEditing(d);
    setEditForm({
      offer_amount: d.offer_amount ? String(Number(d.offer_amount)) : "",
      agreed_amount: d.agreed_amount ? String(Number(d.agreed_amount)) : "",
      expected_close_date: d.expected_close_date
        ? String(d.expected_close_date).slice(0, 10)
        : "",
      notes: d.notes || "",
    });
    setEditErrors({});
  };

  const setEditField = (name) => (e) => {
    setEditForm((prev) => ({ ...prev, [name]: e.target.value }));
    setEditErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submitEdit = async () => {
    const found = {};
    ["offer_amount", "agreed_amount"].forEach((f) => {
      const v = editForm[f];
      if (v !== "" && (isNaN(Number(v)) || Number(v) < 0)) {
        found[f] = t("deals.invalidAmount");
      }
    });
    setEditErrors(found);
    if (Object.keys(found).length > 0) return;

    setEditSaving(true);
    try {
      await client.patch(`/deals/${editing.id}`, {
        offer_amount: editForm.offer_amount,
        agreed_amount: editForm.agreed_amount,
        expected_close_date: editForm.expected_close_date,
        notes: editForm.notes.trim(),
      });
      toast.success(t("deals.updated"));
      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || t("deals.updateError"));
    } finally {
      setEditSaving(false);
    }
  };

  const confirmOverride = () => {
    const pending = override;
    setOverride(null);
    if (pending) changeStage(pending.id, pending.stage, true);
  };

  const stageOptions = STAGES.map((v) => ({
    value: v,
    label: t(`stages.${v}`),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("deals.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("deals.subtitle")}</p>
        </div>
        <Button onClick={openDialog}>
          <Plus />
          {t("deals.add")}
        </Button>
      </div>

      <div>
        <Select
          value={stage}
          onValueChange={(v) => {
            setStage(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder={t("deals.allStages")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("deals.allStages")}</SelectItem>
            {stageOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle className="size-10 text-destructive" />
          <p className="text-muted-foreground">{t("deals.loadError")}</p>
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            {t("common.tryAgain")}
          </Button>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-20 text-center">
          <Handshake className="size-10 text-muted-foreground" />
          <p className="font-medium">{t("deals.noDeals")}</p>
          <p className="text-sm text-muted-foreground">
            {t("deals.noDealsHint")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("deals.property")}</TableHead>
                <TableHead>{t("deals.client")}</TableHead>
                <TableHead>{t("deals.agent")}</TableHead>
                <TableHead>{t("deals.offer")}</TableHead>
                <TableHead>{t("deals.agreed")}</TableHead>
                <TableHead>{t("deals.closeDate")}</TableHead>
                <TableHead>{t("deals.stage")}</TableHead>
                <TableHead>{t("deals.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="max-w-56 truncate font-medium">
                    {d.property_title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.contact_name || t("deals.noClient")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.agent_name || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {d.offer_amount ? (
                      <span dir="ltr" className="inline-block">
                        {formatPrice(d.offer_amount, "PKR", i18n.language)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {d.agreed_amount ? (
                      <span dir="ltr" className="inline-block">
                        {formatPrice(d.agreed_amount, "PKR", i18n.language)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(d.expected_close_date, i18n.language)}
                  </TableCell>
                  <TableCell>
                    {CLOSED_STAGES.includes(d.stage) ? (
                      <Badge
                        variant="secondary"
                        className={cn(STAGE_STYLES[d.stage])}
                      >
                        {t(`stages.${d.stage}`)}
                      </Badge>
                    ) : (
                      <Select
                        value={d.stage}
                        onValueChange={(v) => changeStage(d.id, v)}
                        disabled={updatingId === d.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stageOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {CLOSED_STAGES.includes(d.stage) ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(d)}
                      >
                        <Pencil />
                        {t("deals.edit")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
            <span className="text-muted-foreground">
              {t("deals.total", { count: meta.total })}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                {t("properties.pageOf", {
                  page: meta.page,
                  pages: meta.pages,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("properties.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("properties.next")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("deals.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("deals.dialogSubtitle")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field label={t("deals.property")} error={errors.property_id}>
              <Select
                value={form.property_id}
                onValueChange={setField("property_id")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("deals.selectProperty")} />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("deals.client")}>
              <Select value={form.lead_id} onValueChange={setField("lead_id")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("deals.selectLead")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("deals.noLead")}</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {isAdmin && (
              <Field label={t("deals.agent")}>
                <Select
                  value={form.agent_id}
                  onValueChange={setField("agent_id")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("deals.selectAgent")} />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("deals.offerAmount")} error={errors.offer_amount}>
                <Input
                  type="number"
                  min="0"
                  dir="ltr"
                  value={form.offer_amount}
                  onChange={setField("offer_amount")}
                />
              </Field>
              <Field label={t("deals.expectedClose")}>
                <Input
                  type="date"
                  dir="ltr"
                  value={form.expected_close_date}
                  onChange={setField("expected_close_date")}
                />
              </Field>
            </div>

            <Field label={t("deals.notes")}>
              <Textarea
                rows={2}
                value={form.notes}
                placeholder={t("deals.notesPlaceholder")}
                onChange={setField("notes")}
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={saving} onClick={submit}>
                {saving && <Loader2 className="animate-spin" />}
                {saving ? t("deals.saving") : t("deals.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(value) => !value && setEditing(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("deals.editTitle")}</DialogTitle>
            <DialogDescription>{t("deals.editSubtitle")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("deals.offerAmount")}
                error={editErrors.offer_amount}
              >
                <Input
                  type="number"
                  min="0"
                  dir="ltr"
                  value={editForm.offer_amount}
                  onChange={setEditField("offer_amount")}
                />
              </Field>
              <Field
                label={t("deals.agreedAmount")}
                error={editErrors.agreed_amount}
              >
                <Input
                  type="number"
                  min="0"
                  dir="ltr"
                  value={editForm.agreed_amount}
                  onChange={setEditField("agreed_amount")}
                />
              </Field>
            </div>

            <Field label={t("deals.expectedClose")}>
              <Input
                type="date"
                dir="ltr"
                value={editForm.expected_close_date}
                onChange={setEditField("expected_close_date")}
              />
            </Field>

            <Field label={t("deals.notes")}>
              <Textarea
                rows={2}
                value={editForm.notes}
                placeholder={t("deals.notesPlaceholder")}
                onChange={setEditField("notes")}
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={editSaving} onClick={submitEdit}>
                {editSaving && <Loader2 className="animate-spin" />}
                {editSaving ? t("deals.saving") : t("deals.saveChanges")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(override)}
        onOpenChange={(value) => !value && setOverride(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deals.overrideTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deals.overrideText")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmOverride}>
              {t("deals.overrideConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Deals;