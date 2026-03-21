/**
 * output.ts — Unified JSON envelope and exit code handling.
 *
 * All CLI output goes through this module to ensure consistent
 * envelope format and exit codes for agent consumption.
 *
 * Instead of calling process.exit() directly (which can cause stdout
 * to not flush), we throw a CliExit sentinel error that the top-level
 * catches. This ensures clean shutdown and testability.
 */

/** Exit codes */
export const EXIT = {
  OK: 0,
  ERROR: 1,
  NOT_FOUND: 2,
  FORBIDDEN: 3,
  AUTH_FAILED: 4,
  TIMEOUT: 5,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** Error codes for the JSON envelope */
export type ErrorCode =
  | "GENERAL_ERROR"
  | "INVALID_ARGS"
  | "NETWORK_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "AUTH_EXPIRED"
  | "AUTH_FAILED"
  | "TIMEOUT";

interface SuccessEnvelope<T = unknown> {
  ok: true;
  data: T;
}

interface ErrorEnvelope {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

/**
 * Sentinel error thrown by success() and fail() to signal CLI exit.
 * Caught by the top-level runner to set process.exitCode cleanly.
 */
export class CliExit extends Error {
  constructor(public readonly exitCode: ExitCode) {
    super(`CLI exit with code ${exitCode}`);
    this.name = "CliExit";
  }
}

type OutputFormat = "json" | "text";

let currentFormat: OutputFormat = "json";

export function setOutputFormat(format: OutputFormat): void {
  currentFormat = format;
}

export function getOutputFormat(): OutputFormat {
  return currentFormat;
}

/**
 * Output success data and throw CliExit(0).
 */
export function success<T>(data: T, textFormatter?: (data: T) => string): never {
  if (currentFormat === "json") {
    const envelope: SuccessEnvelope<T> = { ok: true, data };
    process.stdout.write(JSON.stringify(envelope) + "\n");
  } else {
    const text = textFormatter ? textFormatter(data) : JSON.stringify(data, null, 2);
    process.stdout.write(text + "\n");
  }
  throw new CliExit(EXIT.OK);
}

/**
 * Output error and throw CliExit with appropriate code.
 */
export function fail(code: ErrorCode, message: string, exitCode?: ExitCode): never {
  const resolvedExitCode = exitCode ?? errorCodeToExitCode(code);

  if (currentFormat === "json") {
    const envelope: ErrorEnvelope = { ok: false, error: { code, message } };
    process.stdout.write(JSON.stringify(envelope) + "\n");
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
  throw new CliExit(resolvedExitCode);
}

function errorCodeToExitCode(code: ErrorCode): ExitCode {
  switch (code) {
    case "NOT_FOUND":
      return EXIT.NOT_FOUND;
    case "FORBIDDEN":
      return EXIT.FORBIDDEN;
    case "AUTH_EXPIRED":
    case "AUTH_FAILED":
      return EXIT.AUTH_FAILED;
    case "TIMEOUT":
      return EXIT.TIMEOUT;
    default:
      return EXIT.ERROR;
  }
}
