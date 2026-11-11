import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PropertyCard from "@/components/PropertyCard";
import client from "@/api/client";

const PAGE_SIZE = 6;
const ALL = "all";
const PURPOSES = ["sale", "rent"];
const TYPES = ["house", "apartment", "villa", "plot", "commercial"];
const BEDROOMS = [1, 2, 3, 4, 5];
const FILTER_KEYS = [
  "q",
  "purpose",
  "type",
  "city",
  "min_price",
  "max_price",
  "bedrooms",
  "sort",
];

function PublicProperties() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") || "";
  const purpose = searchParams.get("purpose") || ALL;
  const type = searchParams.get("type") || ALL;
  const city = searchParams.get("city") || ALL;
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const bedrooms = searchParams.get("bedrooms") || ALL;
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [searchInput, setSearchInput] = useState(q);
  const [minInput, setMinInput] = useState(minPrice);
  const [maxInput, setMaxInput] = useState(maxPrice);
  const [cities, setCities] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Update one or more query params, resetting the page to 1
  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === "" || value === ALL || value == null) next.delete(key);
      else next.set(key, value);
    });
    if (!("page" in changes)) next.delete("page");
    setSearchParams(next);
  };

  // Keep the inputs in sync when the URL changes from outside (navbar, back button)
  useEffect(() => {
    setSearchInput(q);
    setMinInput(minPrice);
    setMaxInput(maxPrice);
  }, [q, minPrice, maxPrice]);

  // Debounce the text inputs before writing them to the URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        searchInput.trim() !== q ||
        minInput !== minPrice ||
        maxInput !== maxPrice
      ) {
        updateParams({
          q: searchInput.trim(),
          min_price: minInput,
          max_price: maxInput,
        });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, minInput, maxInput]);

  useEffect(() => {
    client
      .get("/public/filters")
      .then((res) => setCities(res.data.cities || []))
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const params = { page, limit: PAGE_SIZE, sort };
    if (q) params.q = q;
    if (purpose !== ALL) params.purpose = purpose;
    if (type !== ALL) params.type = type;
    if (city !== ALL) params.city = city;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (bedrooms !== ALL) params.bedrooms = bedrooms;

    client
      .get("/public/properties", { params })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.data || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q, purpose, type, city, minPrice, maxPrice, bedrooms, sort, page, reloadKey]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const hasFilters = FILTER_KEYS.some(
    (key) => key !== "sort" && searchParams.get(key)
  );

  const clearFilters = () => {
    setSearchInput("");
    setMinInput("");
    setMaxInput("");
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("public.listTitle")}</h1>
        <p className="text-muted-foreground">{t("public.listSubtitle")}</p>
      </div>

      <div className="mb-8 rounded-2xl border bg-card p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("public.searchPlaceholder")}
              className="h-10 ps-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 lg:hidden"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal />
            {t("public.filters")}
          </Button>
        </div>

        <div
          className={`${showFilters ? "grid" : "hidden"} mt-4 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-4`}
        >
          <Select
            value={purpose}
            onValueChange={(v) => updateParams({ purpose: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("properties.allPurposes")}</SelectItem>
              {PURPOSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`propertyPurpose.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(v) => updateParams({ type: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("properties.allTypes")}</SelectItem>
              {TYPES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`propertyType.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={city} onValueChange={(v) => updateParams({ city: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("public.allCities")}</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={bedrooms}
            onValueChange={(v) => updateParams({ bedrooms: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("public.anyBedrooms")}</SelectItem>
              {BEDROOMS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {t("public.bedroomsPlus", { count: n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min="0"
            dir="ltr"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            placeholder={t("public.minPrice")}
            className="text-start"
          />
          <Input
            type="number"
            min="0"
            dir="ltr"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            placeholder={t("public.maxPrice")}
            className="text-start"
          />

          <Select value={sort} onValueChange={(v) => updateParams({ sort: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("public.sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("public.sortNewest")}</SelectItem>
              <SelectItem value="price_asc">{t("public.sortPriceAsc")}</SelectItem>
              <SelectItem value="price_desc">
                {t("public.sortPriceDesc")}
              </SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              <X />
              {t("public.clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {!loading && !error && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("public.resultsCount", { count: total })}
        </p>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(PAGE_SIZE)].map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">{t("public.loadError")}</p>
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            {t("common.tryAgain")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <h3 className="text-lg font-semibold">{t("public.noResultsTitle")}</h3>
          <p className="text-muted-foreground">{t("public.noResultsText")}</p>
          {hasFilters && (
            <Button variant="outline" className="mt-2" onClick={clearFilters}>
              {t("public.clearFilters")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, i) => (
            <PropertyCard key={p.id} property={p} index={i} />
          ))}
        </div>
      )}

      {!loading && !error && pages > 1 && (
        <div className="mt-10 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            {t("properties.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("properties.pageOf", { page, pages })}
          </span>
          <Button
            variant="outline"
            disabled={page >= pages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            {t("properties.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default PublicProperties;