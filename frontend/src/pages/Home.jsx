import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import PropertyCard from "@/components/PropertyCard";
import client from "@/api/client";

const STEPS = [
  { key: "how1", icon: Search },
  { key: "how2", icon: Sparkles },
  { key: "how3", icon: ArrowRight },
];

function Home() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ArrowIcon = i18n.language === "ar" ? ArrowLeft : ArrowRight;

  const [search, setSearch] = useState("");
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get("/public/properties/featured")
      .then((res) => setFeatured(Array.isArray(res.data) ? res.data : []))
      .catch(() => setFeatured([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/properties?q=${encodeURIComponent(q)}` : "/properties");
  };

  return (
    <div>
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="pointer-events-none absolute -top-24 end-0 size-96 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 start-0 size-96 rounded-full bg-sidebar-primary/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-28">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold leading-tight sm:text-5xl"
          >
            {t("public.heroTitle")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-2xl text-base text-sidebar-foreground/70 sm:text-lg"
          >
            {t("public.heroSubtitle")}
          </motion.p>
          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("public.heroSearchPlaceholder")}
                className="h-11 bg-background ps-9 text-foreground"
              />
            </div>
            <Button type="submit" size="lg" className="h-11">
              {t("public.heroSearchButton")}
            </Button>
          </motion.form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{t("public.featuredTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("public.featuredSubtitle")}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/properties">
              {t("public.viewAll")}
              <ArrowIcon />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            {t("public.noFeatured")}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <PropertyCard key={p.id} property={p} index={i} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-2xl font-semibold">
            {t("public.howTitle")}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map(({ key, icon: Icon }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </div>
                <h3 className="font-semibold">{t(`public.${key}Title`)}</h3>
                <p className="text-sm text-muted-foreground">
                  {t(`public.${key}Text`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-sidebar p-10 text-center text-sidebar-foreground">
          <Sparkles className="size-8 text-sidebar-primary" />
          <h2 className="text-2xl font-semibold">{t("public.matchTitle")}</h2>
          <p className="max-w-xl text-sidebar-foreground/70">
            {t("public.matchText")}
          </p>
          <Button asChild size="lg">
            <Link to="/properties">{t("public.matchButton")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

export default Home;