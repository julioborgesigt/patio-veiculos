import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { CheckCircle2 } from "lucide-react";
import { DESTINO_DEVOLUCAO_OPTIONS, type DestinoDevolucao, type Vehicle } from "./types";

type ReturnVehicleDialogProps = {
  vehicle: Vehicle;
  onMarkReturned: (vehicle: Vehicle, destino: DestinoDevolucao, descricao: string | null) => void;
  onUndoReturn: (vehicle: Vehicle) => void;
};

export function ReturnVehicleDialog({ vehicle, onMarkReturned, onUndoReturn }: ReturnVehicleDialogProps) {
  const isReturned = vehicle.devolvido === "sim";
  const [open, setOpen] = useState(false);
  const [destino, setDestino] = useState<DestinoDevolucao | "">("");
  const [descricao, setDescricao] = useState("");

  const label = vehicle.placaOriginal || vehicle.placaOstentada || "Sem placa";
  const markValid = destino !== "" && (destino !== "outros" || descricao.trim() !== "");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Reseta o formulário sempre que o diálogo é aberto.
      setDestino("");
      setDescricao("");
    }
  }

  function handleMark() {
    if (destino === "" || !markValid) return;
    onMarkReturned(vehicle, destino, destino === "outros" ? descricao.trim() : null);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${
            isReturned
              ? "text-green-500 hover:text-green-600 hover:bg-green-500/10"
              : "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
          }`}
          title={isReturned ? "Devolvido (clique para desfazer)" : "Marcar como Devolvido"}
        >
          <CheckCircle2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isReturned ? "Desfazer Devolução" : "Marcar como Devolvido"}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground block mb-1">
              {label} — {vehicle.marca} {vehicle.modelo}
            </span>
            {isReturned
              ? 'Deseja desfazer a devolução? O veículo voltará para o status "No Pátio" e o destino registrado será removido.'
              : 'Confirma a devolução deste veículo? O status será alterado para "Devolvido" e a perícia será marcada como "Feita" automaticamente.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isReturned && (
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label htmlFor="destinoDevolucao">Destino do Veículo</Label>
              <Select
                value={destino}
                onValueChange={(v: string) => {
                  setDestino(v as DestinoDevolucao);
                  if (v !== "outros") setDescricao("");
                }}
              >
                <SelectTrigger id="destinoDevolucao">
                  <SelectValue placeholder="Selecione para onde foi o veículo..." />
                </SelectTrigger>
                <SelectContent>
                  {DESTINO_DEVOLUCAO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {destino === "outros" && (
              <div className="space-y-2">
                <Label htmlFor="destinoDevolucaoDescricao">Descrição do Destino</Label>
                <Input
                  id="destinoDevolucaoDescricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value.slice(0, 50))}
                  placeholder="Para onde foi o veículo"
                  maxLength={50}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-right">{descricao.length}/50 caracteres</p>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {isReturned ? (
            <AlertDialogAction
              onClick={() => onUndoReturn(vehicle)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Desfazer Devolução
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              onClick={handleMark}
              disabled={!markValid}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Confirmar Devolução
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
