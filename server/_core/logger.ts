/**
 * Simple logger utility that respects NODE_ENV
 * Logs are suppressed in production unless LOG_LEVEL is set
 */

const isDev = process.env.NODE_ENV !== "production";
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

function formatMessage(prefix: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${prefix} ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`;
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
