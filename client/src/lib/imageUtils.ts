/**
 * Compressão de imagens no lado do cliente usando a Canvas API.
 *
 * Parâmetros de mercado adotados:
 *   - Dimensão máxima: 1280×960 px (mantém proporção original)
 *   - Formato de saída: JPEG
 *   - Qualidade: 0.75 (reduz ~85-90% do tamanho original de uma foto de celular)
 *
 * Resultado típico: foto de 4-8 MB → ~100-250 KB após compressão.
 */

const MAX_WIDTH = 1280;
const MAX_HEIGHT = 960;
const JPEG_QUALITY = 0.75;

/**
 * Comprime um File/Blob de imagem e retorna um Blob JPEG otimizado.
 * Mantém a proporção original; não aumenta imagens menores que os limites.
 */
export async function compressImage(file: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Redimensiona apenas se necessário
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas não disponível"));
        return;
      }

      // Fundo branco para imagens com transparência (PNG → JPEG)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Falha ao comprimir imagem"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = objectUrl;
  });
}
