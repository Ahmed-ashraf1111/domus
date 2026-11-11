import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Pencil,
  Plus,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import client from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const ROLE_STYLES = {
  admin: "bg-primary/10 text-primary",
  agent: "bg-muted text-muted-foreground",
};

const STATUS_BADGE_STYLES = {
  active: "bg-success/15 text-success",
  inactive: "bg-muted text-muted-foreground",
};

function Staff() {
  const { t } = useTranslation();
  const { user: me } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    client
      .get("/users")
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  const changeStatus = async () => {
    if (!target) return;
    const nextStatus = target.status === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      await client.put(`/users/${target.id}`, { status: nextStatus });
      toast.success(
        nextStatus === "active"
          ? t("staff.activated")
          : t("staff.deactivated")
      );
      setTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || t("staff.saveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("staff.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("staff.subtitle")}</p>
        </div>
        <Button asChild>
          <Link to="/app/staff/new">
            <Plus />
            {t("staff.add")}
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle className="size-10 text-destructive" />
          <p className="text-muted-foreground">{t("staff.loadError")}</p>
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            {t("common.tryAgain")}
          </Button>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-20 text-center">
          <Users className="size-10 text-muted-foreground" />
          <p className="font-medium">{t("staff.noStaff")}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("staff.name")}</TableHead>
                <TableHead>{t("staff.email")}</TableHead>
                <TableHead>{t("staff.phone")}</TableHead>
                <TableHead>{t("staff.role")}</TableHead>
                <TableHead>{t("staff.status")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((u) => {
                const isMe = u.id === me?.id;
                const inactive = u.status !== "active";
                return (
                  <TableRow key={u.id} className={cn(inactive && "opacity-60")}>
                    <TableCell>
                      <Link
                        to={`/app/staff/${u.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {u.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span dir="ltr" className="inline-block">
                        {u.email}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.phone ? (
                        <span dir="ltr" className="inline-block">
                          {u.phone}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(ROLE_STYLES[u.role])}
                      >
                        {u.role === "admin"
                          ? t("staff.roleAdmin")
                          : t("staff.roleAgent")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(STATUS_BADGE_STYLES[u.status])}
                      >
                        {inactive
                          ? t("staff.statusInactive")
                          : t("staff.statusActive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/app/staff/${u.id}/edit`}>
                            <Pencil />
                          </Link>
                        </Button>
                        {!isMe && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTarget(u)}
                          >
                            {inactive ? <UserCheck /> : <UserX />}
                            {inactive
                              ? t("staff.activate")
                              : t("staff.deactivate")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="border-t p-4 text-sm text-muted-foreground">
            {t("staff.total", { count: items.length })}
          </div>
        </div>
      )}

      <AlertDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.status === "active"
                ? t("staff.deactivate")
                : t("staff.activate")}
              {target ? `: ${target.full_name}` : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.status === "active"
                ? t("staff.confirmDeactivate")
                : t("staff.confirmActivate")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                changeStatus();
              }}
              variant={target?.status === "active" ? "destructive" : "default"}
            >
              {target?.status === "active"
                ? t("staff.deactivate")
                : t("staff.activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Staff;