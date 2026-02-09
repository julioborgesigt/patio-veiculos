import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Car,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  CheckCircle,
  CheckCircle2,
  Clock,
  XCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileSpreadsheet,
  FileDown,
  Menu,
  X,
  Loader2,
  Zap,
  ClipboardCheck,
} from "lucide-react";
import { exportToCSV, exportToExcel, type VehicleExportData } from "@/lib/export";

type Vehicle = {
  id: number;
  placaOriginal: string | null;
  placaOstentada: string | null;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  ano: string | null;
  anoModelo: string | null;
  chassi: string | null;
  combustivel: string | null;
  municipio: string | null;
  uf: string | null;
  numeroProcedimento: string | null;
  numeroProcesso: string | null;
  observacoes: string | null;
  statusPericia: "pendente" | "sem_pericia" | "feita";
  devolvido: "sim" | "nao";
  dataDevolucao: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
};

type SortField = "createdAt" | "placaOriginal" | "marca" | "statusPericia" | "devolvido";

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDevolvido, setFilterDevolvido] = useState<string>("all");
  const [filterPericia, setFilterPericia] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    placaOriginal: "",
    placaOstentada: "",
    marca: "",
    modelo: "",
    cor: "",
    ano: "",
    anoModelo: "",
    chassi: "",
    combustivel: "",
    municipio: "",
    uf: "",
    numeroProcedimento: "",
    numeroProcesso: "",
    observacoes: "",
    statusPericia: "pendente" as "pendente" | "sem_pericia" | "feita",
    devolvido: "nao" as "sim" | "nao",
  });

  // State para busca de placa
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Build filters
  const filters = useMemo(() => {
    const f: {
      search?: string;
      devolvido?: "sim" | "nao";
      statusPericia?: "pendente" | "sem_pericia" | "feita";
    } = {};
    if (debouncedSearch) f.search = debouncedSearch;
    if (filterDevolvido !== "all") f.devolvido = filterDevolvido as "sim" | "nao";
    if (filterPericia !== "all") f.statusPericia = filterPericia as "pendente" | "sem_pericia" | "feita";
    return f;
  }, [debouncedSearch, filterDevolvido, filterPericia]);

  // Queries
  const { data: vehiclesData, isLoading: vehiclesLoading } = trpc.vehicles.list.useQuery({
    filters,
    page,
    pageSize: 10,
    sortBy,
    sortOrder,
  });

  const { data: stats, isLoading: statsLoading } = trpc.vehicles.stats.useQuery();

  // Mutations
  const createMutation = trpc.vehicles.create.useMutation({
    onSuccess: () => {
      toast.success("Veículo cadastrado com sucesso!");
      utils.vehicles.list.invalidate();
      utils.vehicles.stats.invalidate();
      resetForm();
      setIsFormOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao cadastrar veículo");
    },
  });

  const updateMutation = trpc.vehicles.update.useMutation({
    onSuccess: () => {
      toast.success("Veículo atualizado com sucesso!");
      utils.vehicles.list.invalidate();
      utils.vehicles.stats.invalidate();
      resetForm();
      setIsFormOpen(false);
      setEditingVehicle(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar veículo");
    },
  });

  const deleteMutation = trpc.vehicles.delete.useMutation({
    onSuccess: () => {
      toast.success("Veículo excluído com sucesso!");
      utils.vehicles.list.invalidate();
      utils.vehicles.stats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir veículo");
    },
  });

  const markAsReturnedMutation = trpc.vehicles.markAsReturned.useMutation({
    onSuccess: () => {
      toast.success("Veículo marcado como devolvido!");
      utils.vehicles.list.invalidate();
      utils.vehicles.stats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao marcar veículo como devolvido");
    },
  });

  const updatePericiaMutation = trpc.vehicles.updatePericiaStatus.useMutation({
    onSuccess: () => {
      toast.success("Status da perícia atualizado!");
      utils.vehicles.list.invalidate();
      utils.vehicles.stats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar status da perícia");
    },
  });

  const undoReturnMutation = trpc.vehicles.undoReturn.useMutation({
    onSuccess: () => {
      toast.success("Devolução desfeita! Veículo voltou para o pátio.");
      utils.vehicles.list.invalidate();
      utils.vehicles.stats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao desfazer devolução");
    },
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Reset form
  const resetForm = () => {
    setFormData({
      placaOriginal: "",
      placaOstentada: "",
      marca: "",
      modelo: "",
      cor: "",
      ano: "",
      anoModelo: "",
      chassi: "",
      combustivel: "",
      municipio: "",
      uf: "",
      numeroProcedimento: "",
      numeroProcesso: "",
      observacoes: "",
      statusPericia: "pendente",
      devolvido: "nao",
    });
  };

  // Buscar dados do veículo pela placa (API experimental)
  const handleSearchPlate = async () => {
    const plate = formData.placaOriginal || formData.placaOstentada;
    if (!plate || plate.length < 7) {
      toast.error("Digite uma placa válida para buscar");
      return;
    }

    setIsSearchingPlate(true);
    try {
      const result = await utils.client.vehicles.searchPlate.query({ plate });
      
      if (result.success && result.data) {
        setFormData(prev => ({
          ...prev,
          marca: result.data!.marca || prev.marca,
          modelo: result.data!.modelo || prev.modelo,
          cor: result.data!.cor || prev.cor,
          ano: result.data!.ano || prev.ano,
          anoModelo: result.data!.anoModelo || prev.anoModelo,
          chassi: result.data!.chassi || prev.chassi,
          combustivel: result.data!.combustivel || prev.combustivel,
          municipio: result.data!.municipio || prev.municipio,
          uf: result.data!.uf || prev.uf,
        }));
        toast.success("Dados do veículo preenchidos automaticamente!");
        
        // Mostrar situação do veículo se houver
        if (result.data.situacao && result.data.situacao !== "Sem restrição") {
          toast.warning(`Atenção: ${result.data.situacao}`);
        }
      } else {
        toast.error(result.error || "Não foi possível buscar os dados. Preencha manualmente.");
      }
    } catch (error) {
      toast.error("Erro ao consultar a placa. A API pode estar indisponível. Preencha manualmente.");
    } finally {
      setIsSearchingPlate(false);
    }
  };

  // Open edit form
  const openEditForm = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      placaOriginal: vehicle.placaOriginal || "",
      placaOstentada: vehicle.placaOstentada || "",
      marca: vehicle.marca || "",
      modelo: vehicle.modelo || "",
      cor: vehicle.cor || "",
      ano: vehicle.ano || "",
      anoModelo: vehicle.anoModelo || "",
      chassi: vehicle.chassi || "",
      combustivel: vehicle.combustivel || "",
      municipio: vehicle.municipio || "",
      uf: vehicle.uf || "",
      numeroProcedimento: vehicle.numeroProcedimento || "",
      numeroProcesso: vehicle.numeroProcesso || "",
      observacoes: vehicle.observacoes || "",
      statusPericia: vehicle.statusPericia,
      devolvido: vehicle.devolvido,
    });
    setIsFormOpen(true);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    const procedimentoRegex = /^\d{3}-\d{5}\/\d{4}$/;
    const processoRegex = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

    if (formData.numeroProcedimento && !procedimentoRegex.test(formData.numeroProcedimento)) {
      toast.error("Formato de procedimento inválido. Use: xxx-xxxxx/ano (ex: 001-00001/2024)");
      return;
    }

    if (formData.numeroProcesso && !processoRegex.test(formData.numeroProcesso)) {
      toast.error("Formato de processo inválido. Use: xxxxxxx-xx.xxxx.x.xx.xxxx (ex: 0000001-00.2024.8.26.0001)");
      return;
    }

    const data = {
      placaOriginal: formData.placaOriginal || null,
      placaOstentada: formData.placaOstentada || null,
      marca: formData.marca || null,
      modelo: formData.modelo || null,
      cor: formData.cor || null,
      ano: formData.ano || null,
      anoModelo: formData.anoModelo || null,
      chassi: formData.chassi || null,
      combustivel: formData.combustivel || null,
      municipio: formData.municipio || null,
      uf: formData.uf || null,
      numeroProcedimento: formData.numeroProcedimento || null,
      numeroProcesso: formData.numeroProcesso || null,
      observacoes: formData.observacoes || null,
      statusPericia: formData.statusPericia,
      devolvido: formData.devolvido,
    };

    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Export functions - fetch ALL vehicles (not just current page)
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const allVehicles = await utils.client.vehicles.export.query(filters);
      if (!allVehicles.length) {
        toast.error("Nenhum veículo para exportar");
        return;
      }
      exportToCSV(allVehicles as VehicleExportData[]);
      toast.success(`${allVehicles.length} veículos exportados para CSV!`);
    } catch (error) {
      toast.error("Erro ao exportar CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const allVehicles = await utils.client.vehicles.export.query(filters);
      if (!allVehicles.length) {
        toast.error("Nenhum veículo para exportar");
        return;
      }
      await exportToExcel(allVehicles as VehicleExportData[]);
      toast.success(`${allVehicles.length} veículos exportados para Excel!`);
    } catch (error) {
      toast.error("Erro ao exportar Excel");
    } finally {
      setIsExporting(false);
    }
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Pericia badge
  const getPericiaStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return (
          <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 bg-yellow-500/10">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case "feita":
        return (
          <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">
            <CheckCircle className="w-3 h-3 mr-1" />
            Feita
          </Badge>
        );
      case "sem_pericia":
        return (
          <Badge variant="outline" className="border-gray-500/50 text-gray-400 bg-gray-500/10">
            <XCircle className="w-3 h-3 mr-1" />
            Sem Perícia
          </Badge>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPages = Math.ceil((vehiclesData?.total || 0) / 10);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:block">Pátio Veículos</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Olá, <span className="text-foreground font-medium">{user?.name || "Usuário"}</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>

          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border p-4 bg-background">
            <div className="flex flex-col gap-3">
              <span className="text-sm text-muted-foreground">
                Olá, <span className="text-foreground font-medium">{user?.name || "Usuário"}</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">No Pátio</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-primary">{stats?.totalNoPatio || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Devolvidos</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-green-400">{stats?.totalDevolvidos || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Perícia Pendente</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-yellow-400">{stats?.periciasPendentes || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Geral</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-accent">{stats?.totalGeral || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar placa, processo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-input border-border"
              />
            </div>

            <Select
              value={filterDevolvido}
              onValueChange={(v) => {
                setFilterDevolvido(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40 bg-input border-border">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="nao">No Pátio</SelectItem>
                <SelectItem value="sim">Devolvidos</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterPericia}
              onValueChange={(v) => {
                setFilterPericia(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-44 bg-input border-border">
                <SelectValue placeholder="Perícia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Perícias</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="feita">Feita</SelectItem>
                <SelectItem value="sem_pericia">Sem Perícia</SelectItem>
              </SelectContent>
            </Select>

            {(search || filterDevolvido !== "all" || filterPericia !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDebouncedSearch("");
                  setFilterDevolvido("all");
                  setFilterPericia("all");
                  setPage(1);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleExportCSV} disabled={isExporting} className="flex-1 sm:flex-none">
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              CSV
            </Button>

            <Button variant="outline" onClick={handleExportExcel} disabled={isExporting} className="flex-1 sm:flex-none">
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
              Excel
            </Button>

            <Dialog open={isFormOpen} onOpenChange={(open) => {
              setIsFormOpen(open);
              if (!open) {
                setEditingVehicle(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Novo Veículo</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingVehicle ? "Editar Veículo" : "Cadastrar Novo Veículo"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Placas e Botão de Busca */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>Busca Automática de Dados</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="placaOriginal">Placa Original</Label>
                        <Input
                          id="placaOriginal"
                          value={formData.placaOriginal}
                          onChange={(e) => setFormData({ ...formData, placaOriginal: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                          placeholder="ABC1234"
                          maxLength={7}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="placaOstentada">Placa Ostentada</Label>
                        <Input
                          id="placaOstentada"
                          value={formData.placaOstentada}
                          onChange={(e) => setFormData({ ...formData, placaOstentada: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                          placeholder="XYZ5678"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSearchPlate}
                      disabled={isSearchingPlate || (!formData.placaOriginal && !formData.placaOstentada)}
                      className="w-full border-primary/50 text-primary hover:bg-primary/10"
                    >
                      {isSearchingPlate ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Buscando dados...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Buscar Dados do Veículo pela Placa
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Consulta dados do veículo na base nacional. Se não encontrar, preencha manualmente.
                    </p>
                  </div>

                  {/* Dados do Veículo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="marca">Marca</Label>
                      <Input
                        id="marca"
                        value={formData.marca}
                        onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                        placeholder="Ex: Volkswagen"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modelo">Modelo</Label>
                      <Input
                        id="modelo"
                        value={formData.modelo}
                        onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                        placeholder="Ex: Gol"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cor">Cor</Label>
                      <Input
                        id="cor"
                        value={formData.cor}
                        onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                        placeholder="Ex: Prata"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ano">Ano Fab.</Label>
                      <Input
                        id="ano"
                        value={formData.ano}
                        onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                        placeholder="2020"
                        maxLength={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="anoModelo">Ano Mod.</Label>
                      <Input
                        id="anoModelo"
                        value={formData.anoModelo}
                        onChange={(e) => setFormData({ ...formData, anoModelo: e.target.value })}
                        placeholder="2021"
                        maxLength={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="combustivel">Combustível</Label>
                      <Input
                        id="combustivel"
                        value={formData.combustivel}
                        onChange={(e) => setFormData({ ...formData, combustivel: e.target.value })}
                        placeholder="Flex"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chassi">Chassi</Label>
                      <Input
                        id="chassi"
                        value={formData.chassi}
                        onChange={(e) => setFormData({ ...formData, chassi: e.target.value.toUpperCase() })}
                        placeholder="***12345"
                        maxLength={50}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="municipio">Município</Label>
                      <Input
                        id="municipio"
                        value={formData.municipio}
                        onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                        placeholder="Ex: São Paulo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uf">UF</Label>
                      <Input
                        id="uf"
                        value={formData.uf}
                        onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                        placeholder="SP"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numeroProcedimento">Nº Procedimento</Label>
                      <Input
                        id="numeroProcedimento"
                        value={formData.numeroProcedimento}
                        onChange={(e) => setFormData({ ...formData, numeroProcedimento: e.target.value })}
                        placeholder="001-00001/2024"
                        maxLength={20}
                      />
                      <p className="text-xs text-muted-foreground">Formato: xxx-xxxxx/ano</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numeroProcesso">Nº Processo</Label>
                      <Input
                        id="numeroProcesso"
                        value={formData.numeroProcesso}
                        onChange={(e) => setFormData({ ...formData, numeroProcesso: e.target.value })}
                        placeholder="0000001-00.2024.8.26.0001"
                        maxLength={30}
                      />
                      <p className="text-xs text-muted-foreground">Formato: xxxxxxx-xx.xxxx.x.xx.xxxx</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="statusPericia">Status da Perícia</Label>
                      <Select
                        value={formData.statusPericia}
                        onValueChange={(v) => setFormData({ ...formData, statusPericia: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="feita">Feita</SelectItem>
                          <SelectItem value="sem_pericia">Sem Perícia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="devolvido">Devolvido</Label>
                      <Select
                        value={formData.devolvido}
                        onValueChange={(v) => setFormData({ ...formData, devolvido: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value.slice(0, 200) })}
                      placeholder="Observações sobre o veículo..."
                      rows={3}
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.observacoes.length}/200 caracteres
                    </p>
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {createMutation.isPending || updateMutation.isPending
                        ? "Salvando..."
                        : editingVehicle
                        ? "Atualizar"
                        : "Cadastrar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Vehicles Table */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort("placaOriginal")}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Placas
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort("marca")}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Veículo
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-sm font-medium text-muted-foreground">Procedimento/Processo</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort("statusPericia")}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Perícia
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort("devolvido")}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Status
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-sm font-medium text-muted-foreground">Observações</span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-muted-foreground">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehiclesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-32" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-40" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-20" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-20" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-32" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-8 w-20 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : vehiclesData?.vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Nenhum veículo encontrado</p>
                    </td>
                  </tr>
                ) : (
                  vehiclesData?.vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {vehicle.placaOriginal && (
                            <div className="font-mono text-sm font-medium text-foreground">
                              {vehicle.placaOriginal}
                            </div>
                          )}
                          {vehicle.placaOstentada && (
                            <div className="font-mono text-xs text-muted-foreground">
                              Ost: {vehicle.placaOstentada}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="text-foreground">
                            {vehicle.marca} {vehicle.modelo}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {vehicle.cor} {vehicle.ano && `• ${vehicle.ano}`}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs space-y-1">
                          {vehicle.numeroProcedimento && (
                            <div className="text-muted-foreground">
                              Proc: <span className="text-foreground">{vehicle.numeroProcedimento}</span>
                            </div>
                          )}
                          {vehicle.numeroProcesso && (
                            <div className="text-muted-foreground">
                              Nº: <span className="text-foreground font-mono">{vehicle.numeroProcesso}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{getPericiaStatusBadge(vehicle.statusPericia)}</td>
                      <td className="px-4 py-3">
                        {vehicle.devolvido === "sim" ? (
                          <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">
                            Devolvido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                            No Pátio
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {vehicle.observacoes ? (
                          <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={vehicle.observacoes}>
                            {vehicle.observacoes}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botão Perícia: amarelo quando pendente, verde quando feita/sem_pericia */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  vehicle.statusPericia === "pendente"
                                    ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10"
                                    : "text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                }`}
                                title={
                                  vehicle.statusPericia === "pendente"
                                    ? "Marcar Perícia como Feita"
                                    : vehicle.statusPericia === "feita"
                                    ? "Perícia Feita (clique para reverter)"
                                    : "Sem Perícia (clique para reverter)"
                                }
                              >
                                <ClipboardCheck className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {vehicle.statusPericia === "pendente"
                                    ? "Marcar Perícia como Feita"
                                    : "Reverter Perícia para Pendente"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  <span className="font-medium text-foreground block mb-1">
                                    {vehicle.placaOriginal || vehicle.placaOstentada || "Sem placa"} — {vehicle.marca} {vehicle.modelo}
                                  </span>
                                  {vehicle.statusPericia === "pendente"
                                    ? "Confirma que a perícia deste veículo foi realizada?"
                                    : "Deseja reverter o status da perícia para \"Pendente\"?"}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    updatePericiaMutation.mutate({
                                      id: vehicle.id,
                                      status: vehicle.statusPericia === "pendente" ? "feita" : "pendente",
                                    })
                                  }
                                  className={
                                    vehicle.statusPericia === "pendente"
                                      ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                                      : "bg-green-600 hover:bg-green-700 text-white"
                                  }
                                >
                                  {vehicle.statusPericia === "pendente" ? "Confirmar Perícia" : "Reverter para Pendente"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          {/* Botão Devolvido: laranja quando no pátio, verde quando devolvido */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  vehicle.devolvido === "nao"
                                    ? "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                                    : "text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                }`}
                                title={
                                  vehicle.devolvido === "nao"
                                    ? "Marcar como Devolvido"
                                    : "Devolvido (clique para desfazer)"
                                }
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {vehicle.devolvido === "nao" ? "Marcar como Devolvido" : "Desfazer Devolução"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  <span className="font-medium text-foreground block mb-1">
                                    {vehicle.placaOriginal || vehicle.placaOstentada || "Sem placa"} — {vehicle.marca} {vehicle.modelo}
                                  </span>
                                  {vehicle.devolvido === "nao"
                                    ? "Confirma a devolução deste veículo? O status será alterado para \"Devolvido\" e a perícia será marcada como \"Feita\" automaticamente."
                                    : "Deseja desfazer a devolução? O veículo voltará para o status \"No Pátio\"."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    vehicle.devolvido === "nao"
                                      ? markAsReturnedMutation.mutate({ id: vehicle.id })
                                      : undoReturnMutation.mutate({ id: vehicle.id })
                                  }
                                  className={
                                    vehicle.devolvido === "nao"
                                      ? "bg-orange-500 hover:bg-orange-600 text-white"
                                      : "bg-green-600 hover:bg-green-700 text-white"
                                  }
                                >
                                  {vehicle.devolvido === "nao" ? "Confirmar Devolução" : "Desfazer Devolução"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditForm(vehicle)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <span className="font-medium text-foreground block mb-1">
                                    {vehicle.placaOriginal || vehicle.placaOstentada || "Sem placa"} — {vehicle.marca} {vehicle.modelo}
                                  </span>
                                  Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate({ id: vehicle.id })}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({vehiclesData?.total || 0} veículos)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
