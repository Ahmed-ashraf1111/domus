import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import client from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const ANY = "any";

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

const PURPOSES = ["sale", "rent"];
const TYPES = ["house", "apartment", "villa", "plot", "commercial"];

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
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

// turn the lead row into the values used by the preferences form
function toPrefs(lead) {
  return {
    purpose: lead.purpose || ANY,
    property_type: lead.property_type || ANY,
    budget_min: lead.budget_min ? String(Math.round(lead.budget_min)) : "",
    budget_max: lead.budget_max ? String(Math.round(lead.budget_max)) : "",
    preferred_city: lead.preferred_city || "",
    preferred_bedrooms:
      lead.preferred_bedrooms !== null && lead.preferred_bedrooms !== undefined
        ? String(lead.preferred_bedrooms)
        : "",
    next_follow_up_at: lead.next_follow_up_at
      ? String(lead.next_follow_up_at).slice(0, 10)
      : "",
  };
}

function LeadDetails() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const BackIcon = i18n.language === "ar" ? ArrowRight : ArrowLeft;

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [agents, setAgents] = useState([]);
  const [agentChoice, setAgentChoice] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [changingStage, setChangingStage] = useState(false);

  const [prefs, setPrefs] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    setError(false);
    setNotFound(false);
    client
      .get(`/leads/${id}`)
      .then((res) => {
        setLead(res.data);
        setPrefs(toPrefs(res.data));
        setAgentChoice(
          res.data.assigned_agent_id ? String(res.data.assigned_agent_id) : ""
        );
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, [id, reloadKey]);

  // only the admin can assign, so only the admin needs the agents list
  useEffect(() => {
    if (!isAdmin) return;
    client
      .get("/users/agents")
      .then((res) => setAgents(res.data))
      .catch(() => setAgents([]));
  }, [isAdmin]);

  const reload = () => setReloadKey((k) => k + 1);

  const changeStage = async (stage) => {
    setChangingStage(true);
    try {
      await client.patch(`/leads/${id}/stage`, { stage });
      toast.success(t("leads.stageUpdated"));
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || t("leads.saveError"));
    } finally {
      setChangingStage(false);
    }
  };

  const assignAgent = async () => {
    if (!agentChoice) return;
    setAssigning(true);
    try {
      await client.patch(`/leads/${id}/assign`, {
        agent_id: Number(agentChoice),
      });
      toast.success(t("leads.assigned"));
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || t("leads.saveError"));
    } finally {
      setAssigning(false);
    }
  };

  const setPref = (name) => (valueOrEvent) => {
    const value = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
    setPrefs((prev) => ({ ...prev, [name]: value }));
  };

  const savePrefs = async () => {
    const payload = {
      purpose: prefs.purpose === ANY ? "" : prefs.purpose,
      property_type: prefs.property_type === ANY ? "" : prefs.property_type,
      budget_min: prefs.budget_min,
      budget_max: prefs.budget_max,
      preferred_city: prefs.preferred_city.trim(),
      preferred_bedrooms: prefs.preferred_bedrooms,
      next_follow_up_at: prefs.next_follow_up_at,
    };
    setSavingPrefs(true);
    try {
      await client.patch(`/leads/${id}`, payload);
      toast.success(t("leads.saved"));
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || t("leads.saveError"));
    } finally {
      setSavingPrefs(false);
    }
  };

  const addActivity = async (type) => {
    if (!note.trim()) {
      setNoteError(true);
      return;
    }
    setAddingNote(true);
    try {
      await client.post(`/leads/${id}/activities`, {
        body: note.trim(),
        activity_type: type,
      });
      toast.success(t("leads.noteAdded"));
      setNote("");
      setNoteError(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || t("leads.saveError"));
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error || notFound) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">
          {notFound ? t("leads.notFound") : t("leads.loadError")}
        </p>
        <Button variant="outline" asChild>
          <Link to="/app/leads">{t("leads.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Link
          to="/app/leads"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <BackIcon className="size-4" />
          {t("leads.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{lead.full_name}</h1>
          <Badge variant="secondary" className={cn(STAGE_STYLES[lead.stage])}>
            {t(`stages.${lead.stage}`)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(lead.created_at, i18n.language)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("leads.contactInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} dir="ltr" className="hover:underline">
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} dir="ltr" className="hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              <div className="text-muted-foreground">
                {t("leads.property")}:{" "}
                {lead.property_slug ? (
                  <Link
                    to={`/properties/${lead.property_slug}`}
                    className="text-foreground hover:underline"
                  >
                    {lead.property_title}
                  </Link>
                ) : (
                  t("leads.noProperty")
                )}
              </div>
              {lead.message && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("leads.message")}
                  </div>
                  <p className="whitespace-pre-line">{lead.message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("leads.preferences")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("leads.purpose")}>
                  <Select value={prefs.purpose} onValueChange={setPref("purpose")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>{t("leads.any")}</SelectItem>
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
                    value={prefs.property_type}
                    onValueChange={setPref("property_type")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>{t("leads.any")}</SelectItem>
                      {TYPES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {t(`propertyType.${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("leads.budgetMin")}>
                  <Input
                    type="number"
                    min="0"
                    dir="ltr"
                    value={prefs.budget_min}
                    onChange={setPref("budget_min")}
                  />
                </Field>
                <Field label={t("leads.budgetMax")}>
                  <Input
                    type="number"
                    min="0"
                    dir="ltr"
                    value={prefs.budget_max}
                    onChange={setPref("budget_max")}
                  />
                </Field>
                <Field label={t("leads.city")}>
                  <Input
                    value={prefs.preferred_city}
                    onChange={setPref("preferred_city")}
                  />
                </Field>
                <Field label={t("leads.bedrooms")}>
                  <Input
                    type="number"
                    min="0"
                    dir="ltr"
                    value={prefs.preferred_bedrooms}
                    onChange={setPref("preferred_bedrooms")}
                  />
                </Field>
                <Field label={t("leads.followUpDate")}>
                  <Input
                    type="date"
                    dir="ltr"
                    value={prefs.next_follow_up_at}
                    onChange={setPref("next_follow_up_at")}
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button onClick={savePrefs} disabled={savingPrefs}>
                  {savingPrefs && <Loader2 className="animate-spin" />}
                  {savingPrefs ? t("leads.saving") : t("leads.savePreferences")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("leads.timeline")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Textarea
                  rows={3}
                  value={note}
                  placeholder={t("leads.notePlaceholder")}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteError(false);
                  }}
                />
                {noteError && (
                  <p className="text-xs text-destructive">
                    {t("leads.noteRequired")}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={addingNote}
                    onClick={() => addActivity("call")}
                  >
                    {t("leads.addCall")}
                  </Button>
                  <Button disabled={addingNote} onClick={() => addActivity("note")}>
                    {addingNote && <Loader2 className="animate-spin" />}
                    {t("leads.addNote")}
                  </Button>
                </div>
              </div>

              {lead.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("leads.noActivities")}
                </p>
              ) : (
                <ol className="flex flex-col gap-4 border-s ps-4">
                  {lead.activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {t(`leads.type.${a.activity_type}`, {
                            defaultValue: a.activity_type,
                          })}
                        </Badge>
                        <span>{formatDateTime(a.created_at, i18n.language)}</span>
                        {a.user_name && (
                          <span>{t("leads.by", { name: a.user_name })}</span>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("leads.stageTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={lead.stage}
                onValueChange={changeStage}
                disabled={changingStage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`stages.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("leads.assignTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {lead.agent_name || t("leads.unassigned")}
              </p>
              {isAdmin && (
                <>
                  <Select value={agentChoice} onValueChange={setAgentChoice}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("leads.selectAgent")} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={assigning || !agentChoice}
                    onClick={assignAgent}
                  >
                    {assigning && <Loader2 className="animate-spin" />}
                    {t("leads.assign")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default LeadDetails;