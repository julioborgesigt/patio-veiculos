/**
 * Gerenciamento de fotos de veículos — compatível com AWS S3 e Cloudflare R2.
 *
 * Fluxo de upload:
 *   1. Servidor gera uma presigned URL (PUT, 5 min)
 *   2. Cliente comprime a imagem no browser (Canvas API)
 *   3. Cliente envia o JPEG diretamente ao storage via PUT
 *   4. URL pública é salva no banco junto com o veículo
 *
 * ── Cloudflare R2 (recomendado — gratuito) ─────────────────────────────────
 *
 *   1. Acesse dash.cloudflare.com → R2 → Create bucket
 *   2. Em "Settings" do bucket → Public access → habilite "Allow access"
 *      e anote a URL pública (ex: https://pub-xxxx.r2.dev)
 *   3. Em "Manage R2 API tokens" → Create API Token (Object Read & Write)
 *   4. Configure as variáveis no .env:
 *
 *      AWS_ACCESS_KEY_ID=<Access Key ID do token R2>
 *      AWS_SECRET_ACCESS_KEY=<Secret Access Key do token R2>
 *      AWS_REGION=auto
 *      AWS_S3_BUCKET=<nome do bucket>
 *      AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
 *      AWS_S3_PUBLIC_URL=https://pub-<hash>.r2.dev
 *
 * ── AWS S3 (alternativa paga) ──────────────────────────────────────────────
 *
 *   1. Crie um bucket S3 e adicione a bucket policy:
 *      { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
 *        "Resource": "arn:aws:s3:::SEU-BUCKET/vehicles/*" }
 *   2. Desabilite "Block Public Access" nas configurações do bucket.
 *   3. Configure as variáveis no .env:
 *
 *      AWS_ACCESS_KEY_ID=<sua access key>
 *      AWS_SECRET_ACCESS_KEY=<seu secret>
 *      AWS_REGION=us-east-1
 *      AWS_S3_BUCKET=<nome do bucket>
 *      # AWS_S3_ENDPOINT e AWS_S3_PUBLIC_URL deixe em branco
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./env";

export function isS3Configured(): boolean {
  return !!(ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey);
}

function createS3Client(): S3Client {
  return new S3Client({
    region: ENV.s3Region,
    endpoint: ENV.s3Endpoint || undefined, // R2 exige endpoint; S3 não usa
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
  });
}

/**
 * Gera uma presigned URL para upload (PUT) de uma foto.
 * Expira em 5 minutos. O cliente deve fazer PUT com Content-Type: image/jpeg.
 */
export async function generatePresignedUploadUrl(key: string): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("Storage não configurado. Configure AWS_S3_BUCKET, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY.");
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
 * Retorna a URL pública de um objeto.
 * Para R2: usa AWS_S3_PUBLIC_URL (ex: https://pub-xxx.r2.dev/key)
 * Para S3: constrói a URL padrão (https://bucket.s3.region.amazonaws.com/key)
 */
export function getS3PublicUrl(key: string): string {
  if (ENV.s3PublicUrl) {
    const base = ENV.s3PublicUrl.endsWith("/") ? ENV.s3PublicUrl : `${ENV.s3PublicUrl}/`;
    return `${base}${key}`;
  }
  return `https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com/${key}`;
}

/**
 * Deleta um objeto pelo URL público.
 * Extrai a key a partir da URL e envia o comando de deleção.
 * Falhas são ignoradas para não bloquear a exclusão do veículo.
 */
export async function deleteS3ObjectByUrl(publicUrl: string): Promise<void> {
  if (!isS3Configured()) return;

  try {
    // Determina o prefixo correto dependendo do provider
    const base = ENV.s3PublicUrl
      ? (ENV.s3PublicUrl.endsWith("/") ? ENV.s3PublicUrl : `${ENV.s3PublicUrl}/`)
      : `https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com/`;

    if (!publicUrl.startsWith(base)) return;

    const key = publicUrl.slice(base.length);
    const s3 = createS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: ENV.s3Bucket, Key: key }));
  } catch {
    // Não bloquear a operação principal por falha na limpeza do storage
  }
}
