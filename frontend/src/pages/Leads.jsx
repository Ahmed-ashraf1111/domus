import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, Plus, Search, Users } from "lucide-react";
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
const PURPOSES = ["sale", "rent"];
const TYPES = ["house", "apartment", "villa", "plot", "commercial"];

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  email: "",
  purpose: NONE,
  property_type: NONE,
  budget_min: "",
  budget_max: "",
  preferred_city: "",
  preferred_bedrooms: "",
  assigned_agent_id: NONE,
  message: "",
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

const STAGES = [
  "new",
  "contacted",
  "qualified",
  "visit_scheduled",
  "negotiation",
  "converted",
  "lost",
];

// badge colors for each lead stage
const STAGE_STYLES = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  contacted: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  qualified:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  visit_scheduled:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  negotiation:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  converted:
    "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

function FilterSelect({ value, onChange, placeholder, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

function Leads() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [agents, setAgents] = useState([]);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState(ALL);
  const [agentId, setAgentId] = useState(ALL);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // add lead dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // the agents list is only needed for the admin filter
  useEffect(() => {
    if (!isAdmin) return;
    client
      .get("/users/agents")
      .then((res) => setAgents(res.data))
      .catch(() => setAgents([]));
  }, [isAdmin]);

  // wait a moment after typing before searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = { page, limit: PAGE_SIZE };
    if (query) params.q = query;
    if (stage !== ALL) params.stage = stage;
    if (agentId !== ALL) params.agent_id = agentId;

    setLoading(true);
    setError(false);
    client
      .get("/leads", { params })
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
  }, [query, stage, agentId, page, reloadKey]);

  const changeFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const openDialog = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(true);
  };

  const setField = (name) => (valueOrEvent) => {
    const value = valueOrEvent?.target
      ? valueOrEvent.target.value
      : valueOrEvent;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (!form.full_name.trim()) found.full_name = t("leads.required");
    if (!form.phone.trim() && !form.email.trim()) {
      found.phone = t("leads.contactRequired");
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      found.email = t("leads.invalidEmail");
    }
    ["budget_min", "budget_max"].forEach((f) => {
      if (form[f] !== "" && (isNaN(Number(form[f])) || Number(form[f]) < 0)) {
        found[f] = t("leads.invalidBudget");
      }
    });
    if (
      !found.budget_min &&
      !found.budget_max &&
      form.budget_min !== "" &&
      form.budget_max !== "" &&
      Number(form.budget_max) < Number(form.budget_min)
    ) {
      found.budget_max = t("leads.budgetOrder");
    }
    if (
      form.preferred_bedrooms !== "" &&
      (!Number.isInteger(Number(form.preferred_bedrooms)) ||
        Number(form.preferred_bedrooms) < 0)
    ) {
      found.preferred_bedrooms = t("leads.invalidBudget");
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const payload = { full_name: form.full_name.trim() };
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.purpose !== NONE) payload.purpose = form.purpose;
    if (form.property_type !== NONE) payload.property_type = form.property_type;
    if (form.budget_min !== "") payload.budget_min = Number(form.budget_min);
    if (form.budget_max !== "") payload.budget_max = Number(form.budget_max);
    if (form.preferred_city.trim()) {
      payload.preferred_city = form.preferred_city.trim();
    }
    if (form.preferred_bedrooms !== "") {
      payload.preferred_bedrooms = Number(form.preferred_bedrooms);
    }
    if (form.message.trim()) payload.message = form.message.trim();
    if (isAdmin && form.assigned_agent_id !== NONE) {
      payload.assigned_agent_id = Number(form.assigned_agent_id);
    }

    setSaving(true);
    try {
      await client.post("/leads", payload);
      toast.success(t("leads.created_ok"));
      setOpen(false);
      setPage(1);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || t("leads.createError"));
    } finally {
      setSaving(false);
    }
  };

  const stageOptions = STAGES.map((v) => ({
    value: v,
    label: t(`stages.${v}`),
  }));
  const agentOptions = agents.map((a) => ({
    value: String(a.id),
    label: a.full_name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("leads.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("leads.subtitle")}</p>
        </div>
        <Button onClick={openDialog}>
          <Plus />
          {t("leads.addLead")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("leads.searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <FilterSelect
          value={stage}
          onChange={changeFilter(setStage)}
          placeholder={t("leads.allStages")}
          options={stageOptions}
        />
        {isAdmin && (
          <FilterSelect
            value={agentId}
            onChange={changeFilter(setAgentId)}
            placeholder={t("leads.allAgents")}
            options={agentOptions}
          />
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle className="size-10 text-destructive" />
          <p className="text-muted-foreground">{t("leads.loadError")}</p>
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
          <Users className="size-10 text-muted-foreground" />
          <p className="font-medium">{t("leads.noLeads")}</p>
          <p className="text-sm text-muted-foreground">
            {t("leads.noLeadsHint")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("leads.name")}</TableHead>
                <TableHead>{t("leads.property")}</TableHead>
                <TableHead>{t("leads.stage")}</TableHead>
                <TableHead>{t("leads.agent")}</TableHead>
                <TableHead>{t("leads.source")}</TableHead>
                <TableHead>{t("leads.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link
                      to={`/app/leads/${lead.id}`}
                      className="font-medium hover:underline"
                    >
                      {lead.full_name}
                    </Link>
                    <div
                      dir="ltr"
                      className="text-start text-xs text-muted-foreground"
                    >
                      {lead.phone || lead.email}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {lead.property_title || t("leads.noProperty")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(STAGE_STYLES[lead.stage])}
                    >
                      {t(`stages.${lead.stage}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.agent_name || t("leads.unassigned")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t(`leads.sourceValue.${lead.source}`, {
                      defaultValue: lead.source,
                    })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(lead.created_at, i18n.language)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
            <span className="text-muted-foreground">
              {t("leads.total", { count: meta.total })}
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
            <DialogTitle>{t("leads.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("leads.dialogSubtitle")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field label={t("leads.fullName")} error={errors.full_name}>
              <Input
                value={form.full_name}
                onChange={setField("full_name")}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("leads.phone")} error={errors.phone}>
                <Input
                  dir="ltr"
                  value={form.phone}
                  onChange={setField("phone")}
                />
              </Field>
              <Field label={t("leads.email")} error={errors.email}>
                <Input
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={setField("email")}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("leads.purpose")}>
                <Select
                  value={form.purpose}
                  onValueChange={setField("purpose")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("leads.any")}</SelectItem>
                    {PURPOSES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`propertyPurpose.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("leads.propertyType")}>
                <Select
                  value={form.property_type}
                  onValueChange={setField("property_type")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("leads.any")}</SelectItem>
                    {TYPES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`propertyType.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("leads.budgetMin")} error={errors.budget_min}>
                <Input
                  type="number"
                  dir="ltr"
                  min="0"
                  value={form.budget_min}
                  onChange={setField("budget_min")}
                />
              </Field>
              <Field label={t("leads.budgetMax")} error={errors.budget_max}>
                <Input
                  type="number"
                  dir="ltr"
                  min="0"
                  value={form.budget_max}
                  onChange={setField("budget_max")}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("leads.city")}>
                <Input
                  value={form.preferred_city}
                  onChange={setField("preferred_city")}
                />
              </Field>
              <Field
                label={t("leads.bedrooms")}
                error={errors.preferred_bedrooms}
              >
                <Input
                  type="number"
                  dir="ltr"
                  min="0"
                  value={form.preferred_bedrooms}
                  onChange={setField("preferred_bedrooms")}
                />
              </Field>
            </div>

            {isAdmin && (
              <Field label={t("leads.agent")}>
                <Select
                  value={form.assigned_agent_id}
                  onValueChange={setField("assigned_agent_id")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("leads.noAgent")}</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label={t("leads.message")}>
              <Textarea
                rows={2}
                value={form.message}
                onChange={setField("message")}
              />
            </Field>

            <div className="sticky -bottom-6 flex justify-end gap-2 bg-background pb-1 pt-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={saving} onClick={submit}>
                {saving && <Loader2 className="animate-spin" />}
                {saving ? t("leads.saving") : t("leads.createLead")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Leads;