import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarClock,
  Handshake,
  UserCog,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Moon,
  Sun,
  Languages,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/app", key: "dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/properties", key: "properties", icon: Building2 },
  { to: "/app/leads", key: "leads", icon: Users },
  { to: "/app/visits", key: "visits", icon: CalendarClock },
  { to: "/app/deals", key: "deals", icon: Handshake },
  { to: "/app/staff", key: "staff", icon: UserCog, adminOnly: true },
];

function getInitials(name = "") {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function WorkspaceLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isRtl = i18n.language === "ar";
  const CollapseIcon = collapsed
    ? isRtl
      ? ChevronsLeft
      : ChevronsRight
    : isRtl
    ? ChevronsRight
    : ChevronsLeft;

  const switchLanguage = () => {
    i18n.changeLanguage(isRtl ? "en" : "ar");
  };

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-40 flex h-screen w-64 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300",
          "md:sticky md:top-0 md:z-auto md:translate-x-0 md:rtl:translate-x-0 md:transition-all",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full rtl:translate-x-full",
          collapsed ? "md:w-[72px]" : "md:w-64"
        )}
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground">
            D
          </div>
          <span
            className={cn(
              "text-lg font-semibold",
              collapsed && "md:hidden"
            )}
          >
            {t("common.appName")}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {items.map(({ to, key, icon: Icon, end }) => {
            const link = (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <Icon className="size-5 shrink-0" />
                <span className={cn(collapsed && "md:hidden")}>
                  {t(`nav.${key}`)}
                </span>
              </NavLink>
            );

            if (!collapsed) return link;

            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side={isRtl ? "left" : "right"}>
                  {t(`nav.${key}`)}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="hidden w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:flex"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          >
            <CollapseIcon className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label={t("nav.collapse")}
          >
            <X className="size-5" />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label={t("nav.expand")}
            >
              <Menu />
            </Button>
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("nav.workspace")}
            </h2>
          </div>

          <div className="flex items-center gap-2">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="size-8">
                    <AvatarFallback>
                      {getInitials(user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm sm:inline">
                    {user?.full_name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="text-sm">{user?.full_name}</div>
                  <div className="text-xs font-normal capitalize text-muted-foreground">
                    {user?.role}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut />
                  {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default WorkspaceLayout;