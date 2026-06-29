import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);
  // COOKIE_DOMAIN restricts the cookie to a specific domain/subdomain.
  // Leave unset for single-domain deployments (cookie scoped to request host).
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure,
    domain,
  };
}
