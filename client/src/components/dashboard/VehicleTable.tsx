import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Car,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ClipboardCheck,
  Camera,
} from "lucide-react";
import { destinoLabel, parseFotos, type DestinoDevolucao, type SortField, type Vehicle } from "./types";
import { ReturnVehicleDialog } from "./ReturnVehicleDialog";

type VehicleTableProps = {
  vehicles: Vehicle[];
  loading: boolean;
  sortBy: SortField;
  sortOrder: "asc" | "desc";
  onSort: (field: SortField) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (id: number) => void;
  onTogglePericia: (vehicle: Vehicle) => void;
  onMarkReturned: (vehicle: Vehicle, destino: DestinoDevolucao, descricao: string | null) => void;
  onUndoReturn: (vehicle: Vehicle) => void;
  periciaPending: boolean;
  returnPending: boolean;
  onViewPhotos: (vehicle: Vehicle) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
};

function renderSortIcon(field: SortField, sortBy: SortField, sortOrder: "asc" | "desc") {
  if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
  return sortOrder === "asc"
    ? <ArrowUp className="w-3 h-3 text-primary" />
    : <ArrowDown className="w-3 h-3 text-primary" />;
}

function getPericiaStatusBadge(status: string) {
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
}

export function VehicleTable({
  vehicles,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  onTogglePericia,
  onMarkReturned,
  onUndoReturn,
  periciaPending,
  returnPending,
  onViewPhotos,
  page,
  totalPages,
  total,
  onPageChange,
}: VehicleTableProps) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => onSort("placaOriginal")}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Placas
                  {renderSortIcon("placaOriginal", sortBy, sortOrder)}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => onSort("marca")}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Veículo
                  {renderSortIcon("marca", sortBy, sortOrder)}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-muted-foreground">Procedimento/Processo</span>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => onSort("statusPericia")}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Perícia
                  {renderSortIcon("statusPericia", sortBy, sortOrder)}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => onSort("devolvido")}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Status
                  {renderSortIcon("devolvido", sortBy, sortOrder)}
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
            {loading ? (
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
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum veículo encontrado</p>
                </td>
              </tr>
            ) : (
              vehicles.map((vehicle) => (
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
                      {vehicle.tipoProcedimento && (
                        <div className="text-muted-foreground">
                          Tipo: <span className="text-foreground font-medium">{vehicle.tipoProcedimento}</span>
                        </div>
                      )}
                      {vehicle.numeroProcedimento && (
                        <div className="text-muted-foreground">
                          Nº DP: <span className="text-foreground">{vehicle.numeroProcedimento}</span>
                        </div>
                      )}
                      {vehicle.numeroProcesso && (
                        <div className="text-muted-foreground">
                          Nº Jud.: <span className="text-foreground font-mono">{vehicle.numeroProcesso}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{getPericiaStatusBadge(vehicle.statusPericia)}</td>
                  <td className="px-4 py-3">
                    {vehicle.devolvido === "sim" ? (
                      <div className="space-y-1">
                        <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">
                          Devolvido
                        </Badge>
                        {vehicle.destinoDevolucao && (
                          <div
                            className="text-xs text-muted-foreground max-w-[160px] truncate"
                            title={destinoLabel(vehicle.destinoDevolucao, vehicle.destinoDevolucaoDescricao)}
                          >
                            {destinoLabel(vehicle.destinoDevolucao, vehicle.destinoDevolucaoDescricao)}
                          </div>
                        )}
                      </div>
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
                              disabled={periciaPending}
                              onClick={() => onTogglePericia(vehicle)}
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

                      {/* Botão Devolvido: marca/desfaz devolução (com registro de destino) */}
                      <ReturnVehicleDialog
                        vehicle={vehicle}
                        onMarkReturned={onMarkReturned}
                        onUndoReturn={onUndoReturn}
                        pending={returnPending}
                      />

                      {parseFotos(vehicle.fotos).length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewPhotos(vehicle)}
                          className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                          title="Ver fotos"
                        >
                          <Camera className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(vehicle)}
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
                              onClick={() => onDelete(vehicle.id)}
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
            Página {page} de {totalPages} ({total} veículos)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
