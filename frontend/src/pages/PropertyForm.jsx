import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  CardDescription,
} from "@/components/ui/card";
import client from "@/api/client";
import PropertyMedia from "@/components/PropertyMedia";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PURPOSES = ["sale", "rent"];
const TYPES = ["house", "apartment", "villa", "plot", "commercial"];
const STATUSES = ["draft", "available", "reserved", "sold", "rented"];
const AREA_UNITS = ["sqft", "sqm", "marla", "kanal"];
const AMENITIES = [
  "Parking",
  "Gym",
  "Security",
  "Garden",
  "Pool",
  "Elevator",
  "Balcony",
  "Generator",
  "Air conditioning",
  "Furnished",
];
const NO_AGENT = "none";

const EMPTY = {
  title: "",
  description: "",
  reference_code: "",
  purpose: "sale",
  property_type: "apartment",
  price: "",
  currency: "PKR",
  area_value: "",
  area_unit: "sqft",
  bedrooms: "",
  bathrooms: "",
  city: "",
  locality: "",
  address: "",
  status: "draft",
  assigned_agent_id: NO_AGENT,
  amenities: [],
};

function Field({ label, error, hint, children }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function OptionSelect({ value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Convert the API object into the shape used by the form inputs
function toFormValues(p) {
  return {
    title: p.title || "",
    description: p.description || "",
    reference_code: p.reference_code || "",
    purpose: p.purpose,
    property_type: p.property_type,
    price: p.price ?? "",
    currency: p.currency || "PKR",
    area_value: p.area_value ?? "",
    area_unit: p.area_unit || "sqft",
    bedrooms: p.bedrooms ?? "",
    bathrooms: p.bathrooms ?? "",
    city: p.city || "",
    locality: p.locality || "",
    address: p.address || "",
    status: p.status,
    assigned_agent_id: p.assigned_agent_id
      ? String(p.assigned_agent_id)
      : NO_AGENT,
    amenities: p.amenities || [],
  };
}

function PropertyForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const BackIcon = i18n.language === "ar" ? ArrowRight : ArrowLeft;

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState([]);
  const [isPublished, setIsPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    client
      .get("/users/agents")
      .then((res) => setAgents(Array.isArray(res.data) ? res.data : res.data.data || []))
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError(false);
    client
      .get(`/properties/${id}`)
      .then((res) => {
        setValues(toFormValues(res.data));
        setMedia(res.data.media || []);
        setIsPublished(res.data.is_published);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Reload only the images and publish state after an image action
  const reloadMedia = () => {
    client.get(`/properties/${id}`).then((res) => {
      setMedia(res.data.media || []);
      setIsPublished(res.data.is_published);
    });
  };

  const togglePublish = async () => {
    setPublishing(true);
    try {
      const res = await client.patch(`/properties/${id}/publish`, {
        is_published: !isPublished,
      });
      setIsPublished(res.data.is_published);
      setValues((prev) => ({ ...prev, status: res.data.status }));
      toast.success(
        res.data.is_published
          ? t("propertyForm.publishedDone")
          : t("propertyForm.unpublishedDone")
      );
    } catch (err) {
      toast.error(err.response?.data?.message || t("propertyForm.saveError"));
    } finally {
      setPublishing(false);
    }
  };

  const deleteProperty = async () => {
    try {
      await client.delete(`/properties/${id}`);
      toast.success(t("propertyForm.deleted"));
      navigate("/app/properties", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || t("propertyForm.saveError"));
    }
  };

  const setField = (name) => (valueOrEvent) => {
    const value = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const toggleAmenity = (name) => {
    setValues((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(name)
        ? prev.amenities.filter((a) => a !== name)
        : [...prev.amenities, name],
    }));
  };

  const validate = () => {
    const found = {};
    if (!values.title.trim()) found.title = t("propertyForm.required");
    if (!values.city.trim()) found.city = t("propertyForm.required");
    if (
      values.price === "" ||
      isNaN(Number(values.price)) ||
      Number(values.price) < 0
    ) {
      found.price = t("propertyForm.invalidPrice");
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...values,
      assigned_agent_id:
        values.assigned_agent_id === NO_AGENT ? null : values.assigned_agent_id,
    };
    // An empty code lets the backend generate one on create
    if (!isEdit && !payload.reference_code.trim()) delete payload.reference_code;

    setSaving(true);
    try {
      if (isEdit) {
        await client.put(`/properties/${id}`, payload);
        if (payload.status === "draft") setIsPublished(false);
        toast.success(t("propertyForm.updated"));
      } else {
        const res = await client.post("/properties", payload);
        toast.success(t("propertyForm.created"));
        navigate(`/app/properties/${res.data.id}/edit`, { replace: true });
      }
    } catch (err) {
      const message = err.response?.data?.message;
      toast.error(message || t("propertyForm.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const purposeOptions = PURPOSES.map((v) => ({
    value: v,
    label: t(`propertyPurpose.${v}`),
  }));
  const typeOptions = TYPES.map((v) => ({
    value: v,
    label: t(`propertyType.${v}`),
  }));
  const statusOptions = STATUSES.map((v) => ({
    value: v,
    label: t(`propertyStatus.${v}`),
  }));
  const unitOptions = AREA_UNITS.map((v) => ({
    value: v,
    label: t(`areaUnit.${v}`),
  }));
  const agentOptions = [
    { value: NO_AGENT, label: t("propertyForm.noAgent") },
    ...agents.map((a) => ({ value: String(a.id), label: a.full_name })),
  ];

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{t("propertyForm.loadError")}</p>
        <Button variant="outline" asChild>
          <Link to="/app/properties">{t("propertyForm.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-4xl flex-col gap-6"
      noValidate
    >
      <div>
        <Link
          to="/app/properties"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <BackIcon className="size-4" />
          {t("propertyForm.back")}
        </Link>
        <h1 className="text-2xl font-semibold">
          {isEdit ? t("propertyForm.editTitle") : t("propertyForm.newTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEdit
            ? t("propertyForm.editSubtitle")
            : t("propertyForm.newSubtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("propertyForm.basicInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("propertyForm.titleLabel")} error={errors.title}>
              <Input value={values.title} onChange={setField("title")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("propertyForm.description")}>
              <Textarea
                rows={4}
                value={values.description}
                onChange={setField("description")}
              />
            </Field>
          </div>
          <Field
            label={t("propertyForm.referenceCode")}
            hint={isEdit ? undefined : t("propertyForm.referenceHint")}
          >
            <Input
              value={values.reference_code}
              onChange={setField("reference_code")}
              dir="ltr"
            />
          </Field>
          <Field label={t("propertyForm.status")}>
            <OptionSelect
              value={values.status}
              onChange={setField("status")}
              options={statusOptions}
            />
          </Field>
          <Field label={t("propertyForm.purpose")}>
            <OptionSelect
              value={values.purpose}
              onChange={setField("purpose")}
              options={purposeOptions}
            />
          </Field>
          <Field label={t("propertyForm.type")}>
            <OptionSelect
              value={values.property_type}
              onChange={setField("property_type")}
              options={typeOptions}
            />
          </Field>
          <Field label={t("propertyForm.price")} error={errors.price}>
            <Input
              type="number"
              min="0"
              value={values.price}
              onChange={setField("price")}
              dir="ltr"
            />
          </Field>
          <Field label={t("propertyForm.currency")}>
            <Input
              value={values.currency}
              onChange={setField("currency")}
              dir="ltr"
            />
          </Field>
          <Field label={t("propertyForm.agent")}>
            <OptionSelect
              value={values.assigned_agent_id}
              onChange={setField("assigned_agent_id")}
              options={agentOptions}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("propertyForm.details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t("propertyForm.area")}>
            <Input
              type="number"
              min="0"
              value={values.area_value}
              onChange={setField("area_value")}
              dir="ltr"
            />
          </Field>
          <Field label={t("propertyForm.areaUnit")}>
            <OptionSelect
              value={values.area_unit}
              onChange={setField("area_unit")}
              options={unitOptions}
            />
          </Field>
          <Field label={t("propertyForm.bedrooms")}>
            <Input
              type="number"
              min="0"
              value={values.bedrooms}
              onChange={setField("bedrooms")}
              dir="ltr"
            />
          </Field>
          <Field label={t("propertyForm.bathrooms")}>
            <Input
              type="number"
              min="0"
              value={values.bathrooms}
              onChange={setField("bathrooms")}
              dir="ltr"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("propertyForm.location")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t("propertyForm.city")} error={errors.city}>
            <Input value={values.city} onChange={setField("city")} />
          </Field>
          <Field label={t("propertyForm.locality")}>
            <Input value={values.locality} onChange={setField("locality")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("propertyForm.address")}>
              <Input value={values.address} onChange={setField("address")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("propertyForm.amenitiesTitle")}
          </CardTitle>
          <CardDescription>{t("propertyForm.amenitiesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AMENITIES.map((name) => (
            <label
              key={name}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={values.amenities.includes(name)}
                onCheckedChange={() => toggleAmenity(name)}
              />
              {t(`amenity.${name}`)}
            </label>
          ))}
        </CardContent>
      </Card>

      {isEdit ? (
        <PropertyMedia
          propertyId={id}
          media={media}
          onChange={reloadMedia}
        />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {t("propertyForm.imagesAfterSave")}
          </CardContent>
        </Card>
      )}

      {isEdit && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {t("propertyForm.publishTitle")}
              </CardTitle>
              <CardDescription>
                {isPublished
                  ? t("propertyForm.publishedState")
                  : t("propertyForm.unpublishedState")}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant={isPublished ? "outline" : "default"}
              disabled={publishing}
              onClick={togglePublish}
            >
              {publishing ? (
                <Loader2 className="animate-spin" />
              ) : isPublished ? (
                <EyeOff />
              ) : (
                <Eye />
              )}
              {isPublished
                ? t("propertyForm.unpublish")
                : t("propertyForm.publish")}
            </Button>
          </CardHeader>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {isEdit ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive">
                <Trash2 />
                {t("propertyForm.delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("propertyForm.deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("propertyForm.deleteText")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={deleteProperty}>
                  {t("propertyForm.confirmDelete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? t("propertyForm.saving") : t("propertyForm.save")}
        </Button>
      </div>
    </form>
  );
}

export default PropertyForm;