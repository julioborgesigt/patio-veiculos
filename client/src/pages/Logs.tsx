import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import {
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Undo2,
  History,
  LogIn,
  PlusCircle,
  Pencil,
  Trash2,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  X,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACTION_LABELS: Record<string, { label: string; icon: typeof History; color: string }> = {
  login: { label: "Login", icon: LogIn, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  criar_veiculo: { label: "Cadastrar Veículo", icon: PlusCircle, color: "bg-green-500/10 text-green-500 border-green-500/20" },
  editar_veiculo: { label: "Editar Veículo", icon: Pencil, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  excluir_veiculo: { label: "Excluir Veículo", icon: Trash2, color: "bg-red-500/10 text-red-500 border-red-500/20" },
  marcar_pericia: { label: "Marcar Perícia", icon: ClipboardCheck, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  reverter_pericia: { label: "Reverter Perícia", icon: XCircle, color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  marcar_devolvido: { label: "Marcar Devolvido", icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  desfazer_devolucao: { label: "Desfazer Devolução", icon: Undo2, color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
};

export default function Logs() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = useMemo(() => {
    const f: { action?: string; username?: string } = {};
    if (debouncedSearch) f.username = debouncedSearch;
    if (filterAction !== "all") f.action = filterAction;
    return f;
  }, [debouncedSearch, filterAction]);

  const { data: logsData, isLoading } = trpc.auditLogs.list.useQuery({
    filters,
    page,
    pageSize: 20,
  });

  const revertMutation = trpc.auditLogs.revert.useMutation({
    onSuccess: () => {
      toast.success("Ação revertida com sucesso!");
      utils.auditLogs.list.invalidate();
      utils.vehicles.list.invalidate();
      utils.vehicles.stats.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const totalPages = logsData ? Math.ceil(logsData.total / 20) : 0;

  const canRevert = (action: string, reverted: string) => {
    return reverted !== "sim" && action !== "login";
  };

  const formatDate = (date: string | Date) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/dashboard")}
                className="mr-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <History className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold">Logs de Atividade</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Histórico de ações do sistema
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user?.username}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Filters */}
        <Card className="bg-card border-border p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-input border-border"
              />
            </div>

            <Select
              value={filterAction}
              onValueChange={(v) => {
                setFilterAction(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-52 bg-input border-border">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="criar_veiculo">Cadastrar Veículo</SelectItem>
                <SelectItem value="editar_veiculo">Editar Veículo</SelectItem>
                <SelectItem value="excluir_veiculo">Excluir Veículo</SelectItem>
                <SelectItem value="marcar_pericia">Marcar Perícia</SelectItem>
                <SelectItem value="reverter_pericia">Reverter Perícia</SelectItem>
                <SelectItem value="marcar_devolvido">Marcar Devolvido</SelectItem>
                <SelectItem value="desfazer_devolucao">Desfazer Devolução</SelectItem>
              </SelectContent>
            </Select>

            {(search || filterAction !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDebouncedSearch("");
                  setFilterAction("all");
                  setPage(1);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}

            {logsData && (
              <span className="text-sm text-muted-foreground ml-auto">
                {logsData.total} registro{logsData.total !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </Card>

        {/* Logs Table */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Data/Hora
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Usuário
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Ação
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-48" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-8 ml-auto" /></td>
                    </tr>
                  ))
                ) : logsData?.logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhum log encontrado</p>
                    </td>
                  </tr>
                ) : (
                  logsData?.logs.map((log) => {
                    const actionInfo = ACTION_LABELS[log.action] || {
                      label: log.action,
                      icon: History,
                      color: "bg-muted text-muted-foreground",
                    };
                    const ActionIcon = actionInfo.icon;

                    return (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-foreground">
                            {log.username}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`${actionInfo.color} border gap-1`}>
                            <ActionIcon className="w-3 h-3" />
                            {actionInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground max-w-xs truncate block" title={log.description}>
                            {log.description}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.reverted === "sim" ? (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20">
                              Revertido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              Ativo
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canRevert(log.action, log.reverted) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-500 hover:text-amber-600"
                                  title="Reverter ação"
                                >
                                  <Undo2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reverter Ação</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <span className="font-medium text-foreground block mb-2">
                                      {log.description}
                                    </span>
                                    Tem certeza que deseja reverter esta ação? Os dados serão restaurados ao estado anterior.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => revertMutation.mutate({ id: log.id })}
                                    className="bg-amber-500 hover:bg-amber-600"
                                  >
                                    Reverter
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  Próxima
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
