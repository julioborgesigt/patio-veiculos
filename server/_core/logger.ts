/**
 * Simple logger utility that respects NODE_ENV
 * Logs are suppressed in production unless LOG_LEVEL is set
 */

const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
const logLevel = process.env.LOG_LEVEL || (isDev ? "debug" : "error");

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof levels;

function shouldLog(level: LogLevel): boolean {
  const currentLevel = logLevel in levels ? logLevel as LogLevel : "error";
  return levels[level] <= levels[currentLevel];
}

const SENSITIVE_KEYS = new Set([
  "password", "token", "secret", "accessKey", "secretKey",
  "authorization", "cookie", "jti",
]);

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Error) return { message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map(sanitize);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : sanitize(v);
  }
  return out;
}

function formatMessage(prefix: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const parts = args.map((a) => {
    if (a instanceof Error) return `${a.message}\n${a.stack ?? ""}`;
    if (typeof a === "object") return JSON.stringify(sanitize(a));
    return String(a);
  });
  return `[${timestamp}] ${prefix} ${parts.join(" ")}`;
}

export const logger = {
  error: (prefix: string, ...args: unknown[]) => {
    if (shouldLog("error")) {
      console.error(formatMessage(prefix, ...args));
    }
  },
  warn: (prefix: string, ...args: unknown[]) => {
    if (shouldLog("warn")) {
      console.warn(formatMessage(prefix, ...args));
    }
  },
  info: (prefix: string, ...args: unknown[]) => {
    if (shouldLog("info")) {
      console.info(formatMessage(prefix, ...args));
    }
  },
  debug: (prefix: string, ...args: unknown[]) => {
    if (shouldLog("debug")) {
      console.log(formatMessage(prefix, ...args));
    }
  },
};
