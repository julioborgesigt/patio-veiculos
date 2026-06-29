import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Search, Loader2, Zap } from "lucide-react";
import { VehiclePhotoUpload } from "@/components/VehiclePhotoUpload";
import { DESTINO_DEVOLUCAO_OPTIONS, type DestinoDevolucao, type TipoVeiculo, type Vehicle, type VehicleFormData } from "./types";

type VehicleFormDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: VehicleFormData;
  setFormData: Dispatch<SetStateAction<VehicleFormData>>;
  editingVehicle: Vehicle | null;
  onSubmit: (e: FormEvent) => void;
  onSearchPlate: () => void;
  isSearchingPlate: boolean;
  isSaving: boolean;
};

export function VehicleFormDialog({
  isOpen,
  onOpenChange,
  formData,
  setFormData,
  editingVehicle,
  onSubmit,
  onSearchPlate,
  isSearchingPlate,
  isSaving,
}: VehicleFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Veículo</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          // Impede o Dialog de fechar quando o lightbox de foto está aberto
          if (document.querySelector("[data-photo-lightbox]")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (document.querySelector("[data-photo-lightbox]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{editingVehicle ? "Editar Veículo" : "Cadastrar Novo Veículo"}</DialogTitle>
          <DialogDescription>
            {editingVehicle ? "Altere os dados do veículo abaixo." : "Preencha os dados do veículo para cadastrá-lo no pátio."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
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
              onClick={onSearchPlate}
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoVeiculo">Tipo de Veículo</Label>
              <Select
                value={formData.tipoVeiculo}
                onValueChange={(v: string) => setFormData({ ...formData, tipoVeiculo: v as TipoVeiculo | "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carro">Carro</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoProcedimento">Tipo de Procedimento</Label>
              <Select
                value={formData.tipoProcedimento}
                onValueChange={(v: string) => setFormData({ ...formData, tipoProcedimento: v as "IP" | "TCO" | "BOC" | "BO" | "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IP">IP</SelectItem>
                  <SelectItem value="TCO">TCO</SelectItem>
                  <SelectItem value="BOC">BOC</SelectItem>
                  <SelectItem value="BO">BO</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statusPericia">Status da Perícia</Label>
              <Select
                value={formData.statusPericia}
                onValueChange={(v: string) => setFormData({ ...formData, statusPericia: v as "pendente" | "sem_pericia" | "feita" })}
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
                onValueChange={(v: string) =>
                  setFormData({
                    ...formData,
                    devolvido: v as "sim" | "nao",
                    ...(v === "nao" ? { destinoDevolucao: "" as const, destinoDevolucaoDescricao: "" } : {}),
                  })
                }
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
            {formData.devolvido === "sim" && (
              <div className="space-y-2">
                <Label htmlFor="destinoDevolucao">Destino do Veículo</Label>
                <Select
                  value={formData.destinoDevolucao}
                  onValueChange={(v: string) =>
                    setFormData({
                      ...formData,
                      destinoDevolucao: v as DestinoDevolucao,
                      destinoDevolucaoDescricao: v === "outros" ? formData.destinoDevolucaoDescricao : "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINO_DEVOLUCAO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {formData.devolvido === "sim" && formData.destinoDevolucao === "outros" && (
            <div className="space-y-2">
              <Label htmlFor="destinoDevolucaoDescricao">Descrição do Destino</Label>
              <Input
                id="destinoDevolucaoDescricao"
                value={formData.destinoDevolucaoDescricao}
                onChange={(e) => setFormData({ ...formData, destinoDevolucaoDescricao: e.target.value.slice(0, 50) })}
                placeholder="Para onde foi o veículo"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.destinoDevolucaoDescricao.length}/50 caracteres
              </p>
            </div>
          )}

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

          <div className="space-y-2">
            <Label>Fotos do Veículo</Label>
            <VehiclePhotoUpload
              photos={formData.fotos}
              onPhotosChange={(fotos) => setFormData({ ...formData, fotos })}
              disabled={isSaving}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? "Salvando..." : editingVehicle ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
