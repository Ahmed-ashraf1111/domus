import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Building2, Plus, Search } from "lucide-react";
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
import { formatPrice, imageUrl, STATUS_STYLES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
const ALL = "all";
const PAGE_SIZE = 10;

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

function Properties() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [purpose, setPurpose] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Wait a moment after typing before searching
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
    if (status !== ALL) params.status = status;
    if (purpose !== ALL) params.purpose = purpose;
    if (type !== ALL) params.type = type;

    setLoading(true);
    setError(false);
    client
      .get("/properties", { params })
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
  }, [query, status, purpose, type, page, reloadKey]);

  const changeFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const statusOptions = ["draft", "available", "reserved", "sold", "rented"].map(
    (v) => ({ value: v, label: t(`propertyStatus.${v}`) })
  );
  const purposeOptions = ["sale", "rent"].map((v) => ({
    value: v,
    label: t(`propertyPurpose.${v}`),
  }));
  const typeOptions = [
    "house",
    "apartment",
    "villa",
    "plot",
    "commercial",
  ].map((v) => ({ value: v, label: t(`propertyType.${v}`) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("properties.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("properties.subtitle")}
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/app/properties/new">
              <Plus />
              {t("properties.add")}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("properties.searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <FilterSelect
          value={status}
          onChange={changeFilter(setStatus)}
          placeholder={t("properties.allStatuses")}
          options={statusOptions}
        />
        <FilterSelect
          value={purpose}
          onChange={changeFilter(setPurpose)}
          placeholder={t("properties.allPurposes")}
          options={purposeOptions}
        />
        <FilterSelect
          value={type}
          onChange={changeFilter(setType)}
          placeholder={t("properties.allTypes")}
          options={typeOptions}
        />
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle className="size-10 text-destructive" />
          <p className="text-muted-foreground">{t("properties.loadError")}</p>
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
          <Building2 className="size-10 text-muted-foreground" />
          <p className="font-medium">{t("properties.noProperties")}</p>
          <p className="text-sm text-muted-foreground">
            {t("properties.noPropertiesHint")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("properties.property")}</TableHead>
                <TableHead>{t("properties.reference")}</TableHead>
                <TableHead>{t("properties.purpose")}</TableHead>
                <TableHead>{t("properties.type")}</TableHead>
                <TableHead>{t("properties.price")}</TableHead>
                <TableHead>{t("properties.status")}</TableHead>
                <TableHead>{t("properties.agent")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {p.cover_image && (
                          <img
                            src={imageUrl(p.cover_image)}
                            alt={p.title}
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        {isAdmin ? (
                          <Link
                            to={`/app/properties/${p.id}/edit`}
                            className="truncate font-medium hover:underline"
                          >
                            {p.title}
                          </Link>
                        ) : (
                          <div className="truncate font-medium">{p.title}</div>
                        )}
                        <div className="truncate text-xs text-muted-foreground">
                          {[p.locality, p.city].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.reference_code}
                  </TableCell>
                  <TableCell>{t(`propertyPurpose.${p.purpose}`)}</TableCell>
                  <TableCell>{t(`propertyType.${p.property_type}`)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span dir="ltr" className="inline-block">
                      {formatPrice(p.price, p.currency, i18n.language)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge
                        variant="secondary"
                        className={cn(STATUS_STYLES[p.status])}
                      >
                        {t(`propertyStatus.${p.status}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {p.is_published
                          ? t("properties.published")
                          : t("properties.draft")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.agent_name || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
            <span className="text-muted-foreground">
              {t("properties.total", { count: meta.total })}
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

export default Properties;