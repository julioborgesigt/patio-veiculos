import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";

type VehicleFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  filterDevolvido: string;
  onFilterDevolvidoChange: (value: string) => void;
  filterPericia: string;
  onFilterPericiaChange: (value: string) => void;
  filterTipoVeiculo: string;
  onFilterTipoVeiculoChange: (value: string) => void;
  onClear: () => void;
};

export function VehicleFilters({
  search,
  onSearchChange,
  filterDevolvido,
  onFilterDevolvidoChange,
  filterPericia,
  onFilterPericiaChange,
  filterTipoVeiculo,
  onFilterTipoVeiculoChange,
  onClear,
}: VehicleFiltersProps) {
  const hasActiveFilters = search || filterDevolvido !== "all" || filterPericia !== "all" || filterTipoVeiculo !== "all";

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
      <div className="relative flex-1 sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar placa, processo..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-input border-border"
        />
      </div>

      <Select value={filterDevolvido} onValueChange={onFilterDevolvidoChange}>
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

      <Select value={filterPericia} onValueChange={onFilterPericiaChange}>
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

      <Select value={filterTipoVeiculo} onValueChange={onFilterTipoVeiculoChange}>
        <SelectTrigger className="w-full sm:w-40 bg-input border-border">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Tipos</SelectItem>
          <SelectItem value="carro">Carro</SelectItem>
          <SelectItem value="moto">Moto</SelectItem>
          <SelectItem value="outros">Outros</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
