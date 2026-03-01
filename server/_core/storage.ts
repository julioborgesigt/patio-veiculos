/**
 * Gerenciamento de fotos de veículos no AWS S3.
 *
 * Fluxo de upload:
 *   1. Servidor gera uma presigned URL (PUT, 5 min)
 *   2. Cliente comprime a imagem no browser (Canvas API)
 *   3. Cliente envia o JPEG diretamente ao S3 via PUT
 *   4. URL pública é salva no banco junto com o veículo
 *
 * Configuração do bucket S3:
 *   - Crie um bucket na AWS e adicione a bucket policy abaixo para permitir
 *     leitura pública das fotos:
 *
 *   {
 *     "Version": "2012-10-17",
 *     "Statement": [{
 *       "Effect": "Allow",
 *       "Principal": "*",
 *       "Action": "s3:GetObject",
 *       "Resource": "arn:aws:s3:::SEU-BUCKET/vehicles/*"
 *     }]
 *   }
 *
 *   - Desabilite o "Block Public Access" para que a policy acima funcione.
 *   - Configure as variáveis de ambiente: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 *     AWS_REGION, AWS_S3_BUCKET.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./env";

function isS3Configured(): boolean {
  return !!(ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey);
}

function createS3Client(): S3Client {
  return new S3Client({
    region: ENV.s3Region,
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
  });
}

/**
 * Gera uma presigned URL para upload (PUT) de uma foto.
 * A URL expira em 5 minutos.
 * O cliente deve fazer PUT com Content-Type: image/jpeg.
 */
export async function generatePresignedUploadUrl(key: string): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("S3 não configurado. Configure AWS_S3_BUCKET, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY.");
  }

  const s3 = createS3Client();
  const command = new PutObjectCommand({
    Bucket: ENV.s3Bucket,
    Key: key,
    ContentType: "image/jpeg",
  });

  return getSignedUrl(s3, command, { expiresIn: 300 });
}

/**
 * Retorna a URL pública de um objeto no S3.
 * Exige que o bucket tenha bucket policy com leitura pública para o prefixo vehicles/*.
 */
export function getS3PublicUrl(key: string): string {
  return `https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com/${key}`;
}

/**
 * Deleta um objeto do S3. Extrai a key a partir da URL pública.
 * Usado ao remover fotos de um veículo excluído.
 * Falhas são ignoradas silenciosamente (a exclusão do veículo não deve ser bloqueada).
 */
export async function deleteS3ObjectByUrl(publicUrl: string): Promise<void> {
  if (!isS3Configured()) return;

  try {
    const prefix = `https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com/`;
    if (!publicUrl.startsWith(prefix)) return;

    const key = publicUrl.slice(prefix.length);
    const s3 = createS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: ENV.s3Bucket, Key: key }));
  } catch {
    // Não bloquear a operação principal por falha na limpeza do S3
  }
}

export { isS3Configured };
