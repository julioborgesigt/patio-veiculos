import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseFotos, type Vehicle } from "./types";

type ViewingPhotos = { vehicle: Vehicle; index: number };

type PhotoViewerDialogProps = {
  viewing: ViewingPhotos | null;
  onChange: (viewing: ViewingPhotos | null) => void;
};

export function PhotoViewerDialog({ viewing, onChange }: PhotoViewerDialogProps) {
  return (
    <Dialog open={!!viewing} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>
            {viewing?.vehicle.placaOriginal || viewing?.vehicle.placaOstentada || "Veículo"} — Fotos
          </DialogTitle>
          <DialogDescription>
            {viewing?.vehicle.marca} {viewing?.vehicle.modelo}
            {viewing?.vehicle.cor && ` • ${viewing.vehicle.cor}`}
          </DialogDescription>
        </DialogHeader>
        {viewing && (() => {
          const fotos = parseFotos(viewing.vehicle.fotos);
          return (
            <div className="p-4 pt-2">
              <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh]">
                <img
                  src={fotos[viewing.index]}
                  alt={`Foto ${viewing.index + 1}`}
                  className="max-w-full max-h-[70vh] object-contain"
                />
                {fotos.length > 1 && (
                  <>
                    <button
                      onClick={() => onChange({ ...viewing, index: viewing.index === 0 ? fotos.length - 1 : viewing.index - 1 })}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onChange({ ...viewing, index: (viewing.index + 1) % fotos.length })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              {fotos.length > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  {fotos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => onChange({ ...viewing, index: i })}
                      className={`w-16 h-12 rounded-md overflow-hidden border-2 transition-colors ${
                        i === viewing.index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={url} alt={`Miniatura ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
