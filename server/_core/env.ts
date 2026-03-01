const isProduction = process.env.NODE_ENV === "production";

function getCookieSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && isProduction) {
    throw new Error("JWT_SECRET must be set in production environment");
  }
  return secret ?? "dev-secret-change-in-production";
}

export const ENV = {
  cookieSecret: getCookieSecret(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
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
