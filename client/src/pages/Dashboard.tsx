import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { FileSpreadsheet, FileDown, Loader2 } from "lucide-react";
import { exportToCSV, exportToExcel, type VehicleExportData } from "@/lib/export";
import {
  emptyFormData,
  parseFotos,
  type SortField,
  type Vehicle,
  type VehicleFormData,
} from "@/components/dashboard/types";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { VehicleFilters } from "@/components/dashboard/VehicleFilters";
import { VehicleFormDialog } from "@/components/dashboard/VehicleFormDialog";
import { VehicleTable } from "@/components/dashboard/VehicleTable";
import { PhotoViewerDialog } from "@/components/dashboard/PhotoViewerDialog";

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDevolvido, setFilterDevolvido] = useState<string>("nao");
  const [filterPericia, setFilterPericia] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [viewingPhotos, setViewingPhotos] = useState<{ vehicle: Vehicle; index: number } | null>(null);
  const [formData, setFormData] = useState<VehicleFormData>(emptyFormData());
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

  // Corrige a página se ela passar do total (ex.: excluir o último item da última
  // página deixaria uma página vazia "presa"). Ajuste de estado durante a render —
  // padrão recomendado do React; a guarda `page > tp` garante a convergência.
  if (vehiclesData && page > 1) {
    const tp = Math.max(1, Math.ceil(vehiclesData.total / 10));
    if (page > tp) setPage(tp);
  }

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

  const deletePhotoMutation = trpc.vehicles.deletePhoto.useMutation();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Reset form
  const resetForm = () => {
    setFormData(emptyFormData());
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
    } catch {
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
      tipoProcedimento: vehicle.tipoProcedimento || "",
      numeroProcedimento: vehicle.numeroProcedimento || "",
      numeroProcesso: vehicle.numeroProcesso || "",
      observacoes: vehicle.observacoes || "",
      statusPericia: vehicle.statusPericia,
      devolvido: vehicle.devolvido,
      destinoDevolucao: vehicle.destinoDevolucao || "",
      destinoDevolucaoDescricao: vehicle.destinoDevolucaoDescricao || "",
      fotos: parseFotos(vehicle.fotos),
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

    if (formData.devolvido === "sim") {
      if (!formData.destinoDevolucao) {
        toast.error("Selecione o destino do veículo devolvido.");
        return;
      }
      if (formData.destinoDevolucao === "outros" && !formData.destinoDevolucaoDescricao.trim()) {
        toast.error('Descreva o destino quando selecionar "Outros".');
        return;
      }
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
      tipoProcedimento: formData.tipoProcedimento || null,
      numeroProcedimento: formData.numeroProcedimento || null,
      numeroProcesso: formData.numeroProcesso || null,
      observacoes: formData.observacoes || null,
      statusPericia: formData.statusPericia,
      devolvido: formData.devolvido,
      destinoDevolucao: formData.devolvido === "sim" ? formData.destinoDevolucao || null : null,
      destinoDevolucaoDescricao:
        formData.devolvido === "sim" && formData.destinoDevolucao === "outros"
          ? formData.destinoDevolucaoDescricao.trim() || null
          : null,
      fotos: formData.fotos.length > 0 ? formData.fotos : null,
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
    } catch {
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
    } catch {
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

  // Fecha o formulário, limpando fotos órfãs do S3 (uploadadas mas não salvas)
  const handleFormOpenChange = (open: boolean) => {
    if (!open) {
      const originalFotos = new Set(parseFotos(editingVehicle?.fotos));
      const orphanPhotos = formData.fotos.filter((url) => !originalFotos.has(url));
      for (const url of orphanPhotos) {
        deletePhotoMutation.mutate({ url });
      }
      setEditingVehicle(null);
      resetForm();
    }
    setIsFormOpen(open);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterDevolvido("all");
    setFilterPericia("all");
    setPage(1);
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
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        userName={user?.name}
        onNavigateLogs={() => setLocation("/logs")}
        onLogout={() => logout()}
      />

      <main className="container py-6 space-y-6">
        <StatsCards stats={stats} loading={statsLoading} />

        {/* Actions Bar */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <VehicleFilters
            search={search}
            onSearchChange={setSearch}
            filterDevolvido={filterDevolvido}
            onFilterDevolvidoChange={(v) => {
              setFilterDevolvido(v);
              setPage(1);
            }}
            filterPericia={filterPericia}
            onFilterPericiaChange={(v) => {
              setFilterPericia(v);
              setPage(1);
            }}
            onClear={handleClearFilters}
          />

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

            <VehicleFormDialog
              isOpen={isFormOpen}
              onOpenChange={handleFormOpenChange}
              formData={formData}
              setFormData={setFormData}
              editingVehicle={editingVehicle}
              onSubmit={handleSubmit}
              onSearchPlate={handleSearchPlate}
              isSearchingPlate={isSearchingPlate}
              isSaving={isSaving}
            />
          </div>
        </div>

        <VehicleTable
          vehicles={vehiclesData?.vehicles ?? []}
          loading={vehiclesLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onEdit={openEditForm}
          onDelete={(id) => deleteMutation.mutate({ id })}
          onTogglePericia={(v) =>
            updatePericiaMutation.mutate({
              id: v.id,
              status: v.statusPericia === "pendente" ? "feita" : "pendente",
            })
          }
          onMarkReturned={(v, destino, descricao) =>
            markAsReturnedMutation.mutate({
              id: v.id,
              destinoDevolucao: destino,
              destinoDevolucaoDescricao: descricao,
            })
          }
          onUndoReturn={(v) => undoReturnMutation.mutate({ id: v.id })}
          periciaPending={updatePericiaMutation.isPending}
          returnPending={markAsReturnedMutation.isPending || undoReturnMutation.isPending}
          onViewPhotos={(v) => setViewingPhotos({ vehicle: v, index: 0 })}
          page={page}
          totalPages={totalPages}
          total={vehiclesData?.total ?? 0}
          onPageChange={setPage}
        />
      </main>

      <PhotoViewerDialog viewing={viewingPhotos} onChange={setViewingPhotos} />
    </div>
  );
}
