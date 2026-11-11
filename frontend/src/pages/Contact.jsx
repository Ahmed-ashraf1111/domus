import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import client from "@/api/client";

const EMPTY_FORM = { full_name: "", phone: "", email: "", message: "" };

function FormField({ label, error, children }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Contact() {
  const { t } = useTranslation();

  const [agency, setAgency] = useState(null);
  const [agencyLoading, setAgencyLoading] = useState(true);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(false);

  useEffect(() => {
    client
      .get("/public/agency")
      .then((res) => setAgency(res.data))
      .catch(() => setAgency(null))
      .finally(() => setAgencyLoading(false));
  }, []);

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
      // A general inquiry: no property_id is sent
      await client.post("/public/inquiries", {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
      });
      setSent(true);
      setForm(EMPTY_FORM);
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const infoItems = [
    agency?.phone && { icon: Phone, label: t("public.inquiryPhone"), value: agency.phone, ltr: true },
    agency?.email && { icon: Mail, label: t("public.inquiryEmail"), value: agency.email, ltr: true },
    agency?.address && { icon: MapPin, label: t("propertyForm.address"), value: agency.address },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10 max-w-2xl"
      >
        <h1 className="text-3xl font-bold">{t("public.contactTitle")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("public.contactSubtitle")}
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {agencyLoading ? (
            <>
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </>
          ) : (
            <>
              {agency?.name && (
                <h2 className="text-xl font-semibold">{agency.name}</h2>
              )}
              {infoItems.map(({ icon: Icon, label, value, ltr }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                  className="flex items-center gap-4 rounded-2xl border bg-card p-5"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p
                      className="break-words font-medium"
                      dir={ltr ? "ltr" : undefined}
                      style={ltr ? { textAlign: "start" } : undefined}
                    >
                      {value}
                    </p>
                  </div>
                </motion.div>
              ))}
            </>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-2xl border bg-card p-6 lg:col-span-3"
        >
          <h2 className="text-xl font-semibold">{t("public.contactFormTitle")}</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            {t("public.contactFormSubtitle")}
          </p>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="size-12 text-success" />
              <p className="font-medium">{t("public.inquirySuccess")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <FormField
                label={t("public.inquiryName")}
                error={formErrors.full_name}
              >
                <Input value={form.full_name} onChange={setField("full_name")} />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
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
                </FormField>
                <FormField
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
                </FormField>
              </div>

              <FormField label={t("public.inquiryMessage")}>
                <Textarea
                  rows={5}
                  value={form.message}
                  onChange={setField("message")}
                />
              </FormField>

              {sendError && (
                <p className="text-sm text-destructive">
                  {t("public.inquiryError")}
                </p>
              )}

              <Button type="submit" disabled={sending} className="self-start">
                {sending && <Loader2 className="animate-spin" />}
                {sending ? t("public.inquirySending") : t("public.inquirySend")}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default Contact;