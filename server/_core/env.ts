import { randomBytes } from "crypto";

// Fail-secure: treat any unknown NODE_ENV as production. Only "development"
// and "test" disable production security guards.
const isProduction =
  process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test";

function getCookieSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && isProduction) {
    throw new Error("JWT_SECRET must be set in production environment");
  }
  if (!secret) {
    // Generate a random ephemeral secret for dev — never a known public default.
    return randomBytes(32).toString("hex");
  }
  return secret;
}

export const ENV = {
  cookieSecret: getCookieSecret(),
  isProduction,
  // Storage de fotos (AWS S3 ou Cloudflare R2)
  s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  s3Region: process.env.AWS_REGION ?? "auto",
  s3Bucket: process.env.AWS_S3_BUCKET ?? "",
  // Endpoint customizado — obrigatório para R2, vazio para AWS S3
  s3Endpoint: process.env.AWS_S3_ENDPOINT ?? "",
  // URL base pública das fotos — obrigatório para R2 (ex: https://pub-xxx.r2.dev)
  s3PublicUrl: process.env.AWS_S3_PUBLIC_URL ?? "",
};
