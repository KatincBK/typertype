type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: Level = import.meta.env.DEV ? "debug" : "info";

function emit(level: Level, args: unknown[]) {
  if (order[level] < order[minLevel]) return;
  const ts = new Date().toISOString();
  const fn = level === "debug" ? "log" : level;
  console[fn](`[${ts}] [${level}]`, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
