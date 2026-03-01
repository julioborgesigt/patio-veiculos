/**
 * Componente de upload de fotos para veículos.
 *
 * - Máximo de 2 fotos por veículo
 * - Suporta câmera (câmera traseira do celular) e galeria
 * - Comprime a imagem no browser antes do upload (Canvas API)
 * - Envia o JPEG diretamente ao S3 via presigned URL (não passa pelo servidor)
 */
import { useRef, useState } from "react";
import { Camera, ImageIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { compressImage } from "@/lib/imageUtils";

const MAX_PHOTOS = 2;

interface Props {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  disabled?: boolean;
}

export function VehiclePhotoUpload({ photos, onPhotosChange, disabled }: Props) {
  const [uploading, setUploading] = useState<number | null>(null); // índice do slot em upload
  const cameraRefs = useRef<(HTMLInputElement | null)[]>([null, null]);
  const galleryRefs = useRef<(HTMLInputElement | null)[]>([null, null]);

  const getUploadUrl = trpc.vehicles.getUploadUrl.useMutation();

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slotIndex: number
  ) => {
    const file = e.target.files?.[0];
    // Limpa o input para permitir selecionar o mesmo arquivo de novo
    e.target.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }

    setUploading(slotIndex);

    try {
      // 1. Comprime a imagem no browser
      const compressed = await compressImage(file);

      // 2. Obtém a presigned URL do servidor
      const { presignedUrl, publicUrl } = await getUploadUrl.mutateAsync();

      // 3. Envia o JPEG diretamente ao S3
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: compressed,
        headers: { "Content-Type": "image/jpeg" },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Falha no upload: ${uploadResponse.status}`);
      }

      // 4. Atualiza a lista de fotos com a URL pública
      const updated = [...photos];
      updated[slotIndex] = publicUrl;
      onPhotosChange(updated.slice(0, MAX_PHOTOS));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao enviar foto: ${msg}`);
    } finally {
      setUploading(null);
    }
  };

  const handleRemovePhoto = (slotIndex: number) => {
    const updated = photos.filter((_, i) => i !== slotIndex);
    onPhotosChange(updated);
  };

  const triggerCamera = (slotIndex: number) => {
    cameraRefs.current[slotIndex]?.click();
  };

  const triggerGallery = (slotIndex: number) => {
    galleryRefs.current[slotIndex]?.click();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {Array.from({ length: MAX_PHOTOS }).map((_, slotIndex) => {
          const photoUrl = photos[slotIndex];
          const isLoading = uploading === slotIndex;
          const isDisabled = disabled || uploading !== null;

          return (
            <div key={slotIndex} className="flex-1">
              {/* Inputs ocultos */}
              <input
                ref={(el) => { cameraRefs.current[slotIndex] = el; }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelected(e, slotIndex)}
                disabled={isDisabled}
              />
              <input
                ref={(el) => { galleryRefs.current[slotIndex] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelected(e, slotIndex)}
                disabled={isDisabled}
              />

              {photoUrl ? (
                /* Slot com foto */
                <div className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-[4/3]">
                  <img
                    src={photoUrl}
                    alt={`Foto ${slotIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay com botões de ação */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemovePhoto(slotIndex)}
                      disabled={isDisabled}
                      className="h-7 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Remover
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => triggerCamera(slotIndex)}
                      disabled={isDisabled}
                      className="h-7 text-xs"
                    >
                      <Camera className="h-3 w-3 mr-1" />
                      Trocar
                    </Button>
                  </div>
                  {/* Badge com número da foto */}
                  <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {slotIndex + 1}/{MAX_PHOTOS}
                  </span>
                </div>
              ) : (
                /* Slot vazio */
                <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 aspect-[4/3] flex flex-col items-center justify-center gap-2 p-3">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs text-center">Enviando…</span>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Foto {slotIndex + 1}
                      </span>
                      <div className="flex flex-col gap-1.5 w-full">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => triggerCamera(slotIndex)}
                          disabled={isDisabled}
                          className="h-7 text-xs w-full"
                        >
                          <Camera className="h-3 w-3 mr-1" />
                          Câmera
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => triggerGallery(slotIndex)}
                          disabled={isDisabled}
                          className="h-7 text-xs w-full"
                        >
                          <ImageIcon className="h-3 w-3 mr-1" />
                          Galeria
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Máximo de {MAX_PHOTOS} fotos. Imagens comprimidas automaticamente antes do envio.
      </p>
    </div>
  );
}
