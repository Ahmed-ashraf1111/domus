import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Users,
  CalendarClock,
  Handshake,
  AlertCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import client from "@/api/client";
import { useAuth } from "@/context/AuthContext";

function StatCard({ title, value, hint, icon: Icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>{title}</CardDescription>
        <Icon className="size-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function StageList({ title, rows, emptyText, t }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li
                key={row.stage}
                className="flex items-center justify-between text-sm"
              >
                <span>{t(`stages.${row.stage}`)}</span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-16 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    client
      .get("/dashboard")
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{t("dashboard.loadError")}</p>
        <Button variant="outline" onClick={load}>
          {t("common.tryAgain")}
        </Button>
      </div>
    );
  }

  const chartData = data.leads_last_7_days.map((item) => ({
    day: new Date(item.day + "T00:00:00").toLocaleDateString(i18n.language, {
      weekday: "short",
    }),
    count: item.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("dashboard.welcome", { name: user?.full_name })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("dashboard.properties")}
          value={data.properties.total}
          hint={t("dashboard.propertiesHint", {
            published: data.properties.published,
            available: data.properties.available,
          })}
          icon={Building2}
        />
        <StatCard
          title={t("dashboard.leads")}
          value={data.leads.total}
          hint={t("dashboard.leadsHint", { count: data.leads.new })}
          icon={Users}
        />
        <StatCard
          title={t("dashboard.visits")}
          value={data.visits.upcoming}
          hint={t("dashboard.visitsHint", {
            completed: data.visits.completed,
          })}
          icon={CalendarClock}
        />
        <StatCard
          title={t("dashboard.deals")}
          value={data.deals.open}
          hint={t("dashboard.dealsHint", { won: data.deals.won })}
          icon={Handshake}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("dashboard.leadsChartTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--chart-1)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <StageList
          title={t("dashboard.leadsByStage")}
          rows={data.leads_by_stage}
          emptyText={t("dashboard.noData")}
          t={t}
        />
        <StageList
          title={t("dashboard.dealsByStage")}
          rows={data.deals_by_stage}
          emptyText={t("dashboard.noData")}
          t={t}
        />
      </div>
    </div>
  );
}

export default Dashboard;