import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import client from "@/api/client";
import { useAuth } from "@/context/AuthContext";

const ROLES = ["admin", "agent"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY = {
  full_name: "",
  email: "",
  phone: "",
  role: "agent",
  password: "",
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

function StaffForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const BackIcon = i18n.language === "ar" ? ArrowRight : ArrowLeft;

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const isSelf = isEdit && Number(id) === me?.id;

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError(false);
    client
      .get(`/users/${id}`)
      .then((res) => {
        const u = res.data;
        setValues({
          full_name: u.full_name || "",
          email: u.email || "",
          phone: u.phone || "",
          role: u.role,
          password: "",
        });
        setStatus(u.status);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const setField = (name) => (valueOrEvent) => {
    const value = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (!values.full_name.trim()) found.full_name = t("staff.required");
    if (!values.email.trim()) found.email = t("staff.required");
    else if (!EMAIL_PATTERN.test(values.email.trim()))
      found.email = t("staff.invalidEmail");
    if (!isEdit && !values.password) found.password = t("staff.required");
    else if (values.password && values.password.length < 8)
      found.password = t("staff.shortPassword");
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      role: values.role,
    };
    if (values.password) payload.password = values.password;

    setSaving(true);
    try {
      if (isEdit) {
        await client.put(`/users/${id}`, payload);
        setValues((prev) => ({ ...prev, password: "" }));
        toast.success(t("staff.updated"));
      } else {
        await client.post("/users", payload);
        toast.success(t("staff.created"));
        navigate("/app/staff", { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t("staff.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    const next = status === "active" ? "inactive" : "active";
    setChangingStatus(true);
    try {
      const res = await client.put(`/users/${id}`, { status: next });
      setStatus(res.data.status);
      toast.success(
        next === "active" ? t("staff.activated") : t("staff.deactivated")
      );
    } catch (err) {
      toast.error(err.response?.data?.message || t("staff.saveError"));
    } finally {
      setChangingStatus(false);
    }
  };

  const roleOptions = ROLES.map((v) => ({
    value: v,
    label: v === "admin" ? t("staff.roleAdmin") : t("staff.roleAgent"),
  }));

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{t("staff.loadError2")}</p>
        <Button variant="outline" asChild>
          <Link to="/app/staff">{t("staff.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-3xl flex-col gap-6"
      noValidate
    >
      <div>
        <Link
          to="/app/staff"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <BackIcon className="size-4" />
          {t("staff.back")}
        </Link>
        <h1 className="text-2xl font-semibold">
          {isEdit ? t("staff.editTitle") : t("staff.newTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEdit ? t("staff.editSubtitle") : t("staff.newSubtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("staff.accountInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t("staff.fullName")} error={errors.full_name}>
            <Input
              value={values.full_name}
              onChange={setField("full_name")}
            />
          </Field>
          <Field label={t("staff.email")} error={errors.email}>
            <Input
              type="email"
              value={values.email}
              onChange={setField("email")}
              dir="ltr"
            />
          </Field>
          <Field label={t("staff.phone")}>
            <Input
              value={values.phone}
              onChange={setField("phone")}
              dir="ltr"
            />
          </Field>
          <Field label={t("staff.role")}>
            <Select
              value={values.role}
              onValueChange={setField("role")}
              disabled={isSelf}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={isEdit ? t("staff.newPassword") : t("staff.password")}
              error={errors.password}
              hint={isEdit ? t("staff.newPasswordHint") : t("staff.passwordHint")}
            >
              <Input
                type="password"
                value={values.password}
                onChange={setField("password")}
                dir="ltr"
                autoComplete="new-password"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {isEdit && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {t("staff.accountTitle")}
              </CardTitle>
              <CardDescription>
                {status === "active"
                  ? t("staff.activeState")
                  : t("staff.inactiveState")}
              </CardDescription>
            </div>
            {!isSelf && (
              <Button
                type="button"
                variant={status === "active" ? "destructive" : "default"}
                disabled={changingStatus}
                onClick={toggleStatus}
              >
                {changingStatus ? (
                  <Loader2 className="animate-spin" />
                ) : status === "active" ? (
                  <UserX />
                ) : (
                  <UserCheck />
                )}
                {status === "active"
                  ? t("staff.deactivate")
                  : t("staff.activate")}
              </Button>
            )}
          </CardHeader>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? t("staff.saving") : t("staff.save")}
        </Button>
      </div>
    </form>
  );
}

export default StaffForm;