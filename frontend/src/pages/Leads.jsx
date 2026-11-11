import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
const PAGE_SIZE = 10;

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
      <div>
        <h1 className="text-2xl font-semibold">{t("leads.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("leads.subtitle")}</p>
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
    </div>
  );
}

export default Leads;