import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Languages, Menu, Moon, Sun, X, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import client from "@/api/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", key: "home", end: true },
  { to: "/properties", key: "properties" },
  { to: "/contact", key: "contact" },
];

function PublicLayout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [agency, setAgency] = useState(null);

  const isRtl = i18n.language === "ar";

  useEffect(() => {
    client
      .get("/public/agency")
      .then((res) => setAgency(res.data))
      .catch(() => setAgency(null));
  }, []);

  const switchLanguage = () => {
    i18n.changeLanguage(isRtl ? "en" : "ar");
  };

  const linkClass = ({ isActive }) =>
    cn(
      "text-sm font-medium transition-colors hover:text-foreground",
      isActive ? "text-foreground" : "text-muted-foreground"
    );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/domus-icon.svg" alt="" className="size-9 dark:hidden" />
            <img src="/domus-icon-light.svg" alt="" className="hidden size-9 dark:block" />
            <span className="text-lg font-semibold">{t("common.appName")}</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {LINKS.map(({ to, key, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}>
                {t(`nav.${key}`)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={switchLanguage}
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
            <Button asChild size="sm" className="ms-2 hidden sm:inline-flex">
              <Link to={isAuthenticated ? "/app" : "/login"}>
                {isAuthenticated ? t("nav.workspace") : t("common.login")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {open && (
          <div className="border-t md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
              {LINKS.map(({ to, key, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground"
                    )
                  }
                >
                  {t(`nav.${key}`)}
                </NavLink>
              ))}
              <NavLink
                to={isAuthenticated ? "/app" : "/login"}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground"
              >
                {isAuthenticated ? t("nav.workspace") : t("common.login")}
              </NavLink>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <img src="/domus-icon-light.svg" alt="" className="size-9" />
              <span className="text-lg font-semibold">
                {agency?.name || t("common.appName")}
              </span>
            </div>
            <p className="text-sm text-sidebar-foreground/70">
              {t("public.footerTagline")}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{t("public.quickLinks")}</h3>
            {LINKS.map(({ to, key }) => (
              <Link
                key={to}
                to={to}
                className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                {t(`nav.${key}`)}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{t("public.contactUs")}</h3>
            {agency?.phone && (
              <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
                <Phone className="size-4" />
                <span dir="ltr">{agency.phone}</span>
              </div>
            )}
            {agency?.email && (
              <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
                <Mail className="size-4" />
                <span dir="ltr">{agency.email}</span>
              </div>
            )}
            {agency?.address && (
              <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
                <MapPin className="size-4" />
                <span>{agency.address}</span>
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-sidebar-border py-4 text-center text-xs text-sidebar-foreground/60">
          © {new Date().getFullYear()} {agency?.name || t("common.appName")}.{" "}
          {t("public.rights")}
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;