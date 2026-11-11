import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CalendarClock,
  Loader2,
  Plus,
  TriangleAlert,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

const ALL = "all";
const NONE = "none";
const PAGE_SIZE = 10;

const STATUSES = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];
// only these statuses can still be changed
const OPEN_STATUSES = ["requested", "confirmed"];

// badge colors for each visit status
const STATUS_STYLES = {
  requested:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  no_show: "bg-gray-200 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300",
};

const EMPTY_FORM = {
  property_id: "",
  lead_id: NONE,
  agent_id: "",
  date: "",
  time: "",
  duration_minutes: "60",
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

function formatDateTime(value, locale) {
  if (!value) return "-";
  return new Date(value).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Visits() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);

  // schedule dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [properties, setProperties] = useState([]);
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    const params = { page, limit: PAGE_SIZE };
    if (status !== ALL) params.status = status;

    setLoading(true);
    setError(false);
    client
      .get("/visits", { params })
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
  }, [status, page, reloadKey]);

  // load the lists used by the dialog the first time it opens
  const openDialog = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setConflicts([]);
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
    setConflicts([]);
  };

  const validate = () => {
    const found = {};
    if (!form.property_id) found.property_id = t("visits.required");
    if (!form.date) found.date = t("visits.required");
    if (!form.time) found.time = t("visits.required");
    const duration = Number(form.duration_minutes);
    if (!duration || duration < 15 || duration > 480) {
      found.duration_minutes = t("visits.invalidDuration");
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async (force = false) => {
    if (!validate()) return;

    const payload = {
      property_id: Number(form.property_id),
      starts_at: new Date(`${form.date}T${form.time}`).toISOString(),
      duration_minutes: Number(form.duration_minutes),
      notes: form.notes.trim(),
    };
    if (form.lead_id !== NONE) payload.lead_id = Number(form.lead_id);
    if (isAdmin && form.agent_id) payload.agent_id = Number(form.agent_id);
    if (force) payload.force = true;

    setSaving(true);
    try {
      await client.post("/visits", payload);
      toast.success(t("visits.created"));
      setOpen(false);
      setPage(1);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.conflicts) {
        setConflicts(err.response.data.conflicts);
      } else {
        toast.error(err.response?.data?.message || t("visits.createError"));
      }
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id, next) => {
    setUpdatingId(id);
    try {
      await client.patch(`/visits/${id}/status`, { status: next });
      toast.success(t("visits.statusUpdated"));
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || t("visits.updateError"));
    } finally {
      setUpdatingId(null);
    }
  };

  const statusOptions = STATUSES.map((v) => ({
    value: v,
    label: t(`visits.statusValue.${v}`),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("visits.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("visits.subtitle")}
          </p>
        </div>
        <Button onClick={openDialog}>
          <Plus />
          {t("visits.schedule")}
        </Button>
      </div>

      <div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder={t("visits.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("visits.allStatuses")}</SelectItem>
            {statusOptions.map((opt) => (
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
          <p className="text-muted-foreground">{t("visits.loadError")}</p>
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
          <CalendarClock className="size-10 text-muted-foreground" />
          <p className="font-medium">{t("visits.noVisits")}</p>
          <p className="text-sm text-muted-foreground">
            {t("visits.noVisitsHint")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("visits.property")}</TableHead>
                <TableHead>{t("visits.client")}</TableHead>
                <TableHead>{t("visits.agent")}</TableHead>
                <TableHead>{t("visits.when")}</TableHead>
                <TableHead>{t("visits.status")}</TableHead>
                <TableHead>{t("visits.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="max-w-56 truncate font-medium">
                    {v.property_title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.contact_name || t("visits.noClient")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.agent_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(v.starts_at, i18n.language)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(STATUS_STYLES[v.status])}
                    >
                      {t(`visits.statusValue.${v.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {OPEN_STATUSES.includes(v.status) ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === v.id}
                          onClick={() => changeStatus(v.id, "completed")}
                        >
                          {t("visits.complete")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === v.id}
                          onClick={() => changeStatus(v.id, "cancelled")}
                        >
                          {t("visits.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === v.id}
                          onClick={() => changeStatus(v.id, "no_show")}
                        >
                          {t("visits.noShow")}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
            <span className="text-muted-foreground">
              {t("visits.total", { count: meta.total })}
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
            <DialogTitle>{t("visits.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("visits.dialogSubtitle")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field label={t("visits.property")} error={errors.property_id}>
              <Select
                value={form.property_id}
                onValueChange={setField("property_id")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("visits.selectProperty")} />
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

            <Field label={t("visits.client")}>
              <Select value={form.lead_id} onValueChange={setField("lead_id")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("visits.selectLead")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("visits.noLead")}</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {isAdmin && (
              <Field label={t("visits.agent")}>
                <Select
                  value={form.agent_id}
                  onValueChange={setField("agent_id")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("visits.selectAgent")} />
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
              <Field label={t("visits.date")} error={errors.date}>
                <Input
                  type="date"
                  dir="ltr"
                  value={form.date}
                  onChange={setField("date")}
                />
              </Field>
              <Field label={t("visits.time")} error={errors.time}>
                <Input
                  type="time"
                  dir="ltr"
                  value={form.time}
                  onChange={setField("time")}
                />
              </Field>
            </div>

            <Field
              label={t("visits.duration")}
              error={errors.duration_minutes}
            >
              <Input
                type="number"
                dir="ltr"
                min="15"
                max="480"
                value={form.duration_minutes}
                onChange={setField("duration_minutes")}
              />
            </Field>

            <Field label={t("visits.notes")}>
              <Textarea
                rows={2}
                value={form.notes}
                placeholder={t("visits.notesPlaceholder")}
                onChange={setField("notes")}
              />
            </Field>

            {conflicts.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                <div className="mb-2 flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="size-4" />
                  {t("visits.conflictTitle")}
                </div>
                <ul className="mb-3 flex flex-col gap-1 text-muted-foreground">
                  {conflicts.map((c) => (
                    <li key={c.id}>
                      {c.property_title} -{" "}
                      {formatDateTime(c.starts_at, i18n.language)}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => submit(true)}
                >
                  {t("visits.conflictForce")}
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={saving} onClick={() => submit(false)}>
                {saving && <Loader2 className="animate-spin" />}
                {saving ? t("visits.saving") : t("visits.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Visits;