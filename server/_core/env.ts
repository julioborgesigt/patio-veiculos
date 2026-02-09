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
};
