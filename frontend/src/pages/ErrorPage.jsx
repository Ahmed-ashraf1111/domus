import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shared page for 403 and 404 states
// type: "forbidden" or "notFound"
function ErrorPage({ type = "notFound" }) {
  const { t } = useTranslation();

  const isForbidden = type === "forbidden";
  const Icon = isForbidden ? ShieldAlert : SearchX;
  const titleKey = isForbidden ? "errors.forbiddenTitle" : "errors.notFoundTitle";
  const textKey = isForbidden ? "errors.forbiddenText" : "errors.notFoundText";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
      <p className="max-w-md text-muted-foreground">{t(textKey)}</p>
      <Button asChild>
        <Link to="/app">{t("errors.backHome")}</Link>
      </Button>
    </div>
  );
}

export default ErrorPage;