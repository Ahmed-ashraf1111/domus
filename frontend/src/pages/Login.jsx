import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Languages, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate("/app");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 400) {
        setError(t("auth.invalid"));
      } else if (err.response?.status === 403) {
        setError(t("auth.inactive"));
      } else {
        setError(t("errors.generic"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="rtl:rotate-180" />
            {t("nav.home")}
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => i18n.changeLanguage(isRtl ? "en" : "ar")}
            aria-label={t("common.language")}
          >
            <Languages />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? t("common.lightMode") : t("common.darkMode")
            }
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>

      <Link to="/" className="flex items-center gap-3">
        <img src="/domus-icon.svg" alt="" className="size-10 dark:hidden" />
        <img
          src="/domus-icon-light.svg"
          alt=""
          className="hidden size-10 dark:block"
        />
        <span className="text-xl font-semibold">{t("common.appName")}</span>
      </Link>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.title")}</CardTitle>
          <CardDescription>{t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              {t("auth.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;