// Minimal structured (JSON) logger. One line per event, machine-parseable, so
// logs are usable once the app runs somewhere you can't attach a debugger.
// In production you ship these lines to a log aggregator; locally they're plain
// JSON on stdout.

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, context: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...context,
  });
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (message: string, context: Record<string, unknown> = {}) =>
    emit('info', message, context),
  warn: (message: string, context: Record<string, unknown> = {}) =>
    emit('warn', message, context),
  error: (message: string, context: Record<string, unknown> = {}) =>
    emit('error', message, context),
};
