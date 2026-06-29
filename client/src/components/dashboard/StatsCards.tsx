import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardStats = {
  totalNoPatio: number;
  totalDevolvidos: number;
  periciasPendentes: number;
  totalGeral: number;
};

type StatsCardsProps = {
  stats: DashboardStats | undefined;
  loading: boolean;
};

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const cards = [
    { label: "No Pátio", value: stats?.totalNoPatio, className: "text-primary" },
    { label: "Devolvidos", value: stats?.totalDevolvidos, className: "text-green-400" },
    { label: "Perícia Pendente", value: stats?.periciasPendentes, className: "text-yellow-400" },
    { label: "Total Geral", value: stats?.totalGeral, className: "text-accent" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className={`text-2xl font-bold ${card.className}`}>{card.value || 0}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
