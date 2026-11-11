import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  MapPin,
  Phone,
  Ruler,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import PropertyCard from "@/components/PropertyCard";
import client from "@/api/client";
import { formatPrice, imageUrl } from "@/lib/format";

const EMPTY_FORM = { full_name: "", phone: "", email: "", message: "" };

function InquiryField({ label, error, children }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PublicPropertyDetails() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeImage, setActiveImage] = useState(0);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError(false);
    setActiveImage(0);
    setSent(false);
    setForm(EMPTY_FORM);
    setFormErrors({});

    client
      .get(`/public/properties/${slug}`)
      .then((res) => {
        if (!cancelled) setProperty(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) setNotFound(true);
        else setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [slug]);

  const setField = (name) => (e) => {
    setForm((prev) => ({ ...prev, [name]: e.target.value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (!form.full_name.trim()) found.full_name = t("propertyForm.required");
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!phone && !email) {
      found.phone = t("public.inquiryContactRequired");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      found.email = t("public.inquiryInvalidEmail");
    }
    setFormErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSending(true);
    setSendError(false);
    try {
      await client.post("/public/inquiries", {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
        property_id: property.id,
      });
      setSent(true);
      setForm(EMPTY_FORM);
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-6 w-40" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound || error) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <AlertCircle className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          {notFound ? t("public.notFoundTitle") : t("public.loadError")}
        </h1>
        {notFound && (
          <p className="text-muted-foreground">{t("public.notFoundText")}</p>
        )}
        {error && (
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            {t("common.tryAgain")}
          </Button>
        )}
        <Button asChild>
          <Link to="/properties">{t("public.backToList")}</Link>
        </Button>
      </div>
    );
  }

  const p = property;
  const media = p.media || [];
  const amenities = p.amenities || [];
  const similar = p.similar || [];
  const location = [p.locality, p.city].filter(Boolean).join(", ");
  const current = media[activeImage];

  const goPrev = () =>
    setActiveImage((i) => (i - 1 + media.length) % media.length);
  const goNext = () => setActiveImage((i) => (i + 1) % media.length);

  const facts = [
    { icon: Home, label: t("propertyForm.type"), value: t(`propertyType.${p.property_type}`) },
    p.bedrooms != null && {
      icon: BedDouble,
      label: t("propertyForm.bedrooms"),
      value: p.bedrooms,
    },
    p.bathrooms != null && {
      icon: Bath,
      label: t("propertyForm.bathrooms"),
      value: p.bathrooms,
    },
    p.area_value != null && {
      icon: Ruler,
      label: t("propertyForm.area"),
      value: `${Number(p.area_value).toLocaleString(i18n.language)} ${t(`areaUnit.${p.area_unit}`)}`,
    },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        to="/properties"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <BackIcon className="size-4" />
        {t("public.backToList")}
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          {/* Gallery */}
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
              {current ? (
                <AnimatePresence mode="wait">
                  <motion.img
                    key={current.id}
                    src={imageUrl(current.file_url)}
                    alt={current.caption || p.title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="size-full object-cover"
                  />
                </AnimatePresence>
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Building2 className="size-14 text-muted-foreground" />
                </div>
              )}

              {media.length > 1 && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-label={t("public.previousImage")}
                    onClick={goPrev}
                    className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur"
                  >
                    <PrevIcon />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-label={t("public.nextImage")}
                    onClick={goNext}
                    className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur"
                  >
                    <NextIcon />
                  </Button>
                </>
              )}
            </div>

            {media.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {media.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`size-20 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity ${
                      i === activeImage
                        ? "border-primary"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={imageUrl(m.file_url)}
                      alt={m.caption || p.title}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title and price */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge>{t(`propertyPurpose.${p.purpose}`)}</Badge>
              {p.status && p.status !== "available" && (
                <Badge variant="outline" className="gap-1.5">
                  <span
                    className={
                      p.status === "sold" || p.status === "rented"
                        ? "size-1.5 rounded-full bg-destructive"
                        : "size-1.5 rounded-full bg-amber-500"
                    }
                  />
                  {t(`propertyStatus.${p.status}`)}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold">{p.title}</h1>
            {location && (
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-4 shrink-0" />
                {location}
              </p>
            )}
            <div
              className="text-2xl font-semibold text-primary"
              dir="ltr"
              style={{ textAlign: "start" }}
            >
              {formatPrice(p.price, p.currency, i18n.language)}
            </div>
          </div>

          {/* Key facts */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-4">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <Icon className="size-5 text-primary" />
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          {p.description && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">
                {t("propertyForm.description")}
              </h2>
              <p className="whitespace-pre-line text-muted-foreground">
                {p.description}
              </p>
            </div>
          )}

          {amenities.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">
                {t("propertyForm.amenitiesTitle")}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {amenities.map((a) => (
                  <div key={a} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-success" />
                    {t(`amenity.${a}`, { defaultValue: a })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.address && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">
                {t("propertyForm.address")}
              </h2>
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-4 shrink-0" />
                {p.address}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {p.agent_name && (
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-5">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {t("public.agentTitle")}
                </p>
                <p className="truncate font-medium">{p.agent_name}</p>
                {p.agent_phone && (
                  <a
                    href={`tel:${p.agent_phone}`}
                    dir="ltr"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {p.agent_phone}
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-semibold">{t("public.inquiryTitle")}</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("public.inquirySubtitle")}
            </p>

            {sent ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="size-10 text-success" />
                <p className="font-medium">{t("public.inquirySuccess")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <InquiryField
                  label={t("public.inquiryName")}
                  error={formErrors.full_name}
                >
                  <Input value={form.full_name} onChange={setField("full_name")} />
                </InquiryField>
                <InquiryField
                  label={t("public.inquiryPhone")}
                  error={formErrors.phone}
                >
                  <Input
                    type="tel"
                    dir="ltr"
                    className="text-start"
                    value={form.phone}
                    onChange={setField("phone")}
                  />
                </InquiryField>
                <InquiryField
                  label={t("public.inquiryEmail")}
                  error={formErrors.email}
                >
                  <Input
                    type="email"
                    dir="ltr"
                    className="text-start"
                    value={form.email}
                    onChange={setField("email")}
                  />
                </InquiryField>
                <InquiryField label={t("public.inquiryMessage")}>
                  <Textarea
                    rows={4}
                    value={form.message}
                    onChange={setField("message")}
                  />
                </InquiryField>

                {sendError && (
                  <p className="text-sm text-destructive">
                    {t("public.inquiryError")}
                  </p>
                )}

                <Button type="submit" disabled={sending}>
                  {sending && <Loader2 className="animate-spin" />}
                  {sending ? t("public.inquirySending") : t("public.inquirySend")}
                </Button>
              </form>
            )}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold">
            {t("public.similarTitle")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s, i) => (
              <PropertyCard key={s.id} property={s} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default PublicPropertyDetails;