/* eslint-disable no-console -- The entire purpose of this module is to wrap the global console methods. */

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { nowEpochMs, type TelescopeLogLevel, type TelescopeOptions } from "@workspace/shared";

import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { TELESCOPE_OPTIONS } from "./telescope.options.js";

/**
 * Node's `console` methods accept arbitrary values — the real signature is
 * `(...data: any[])`. The repo bans `any`/`unknown`, so the library boundary
 * is a documented union that covers everything `console` can realistically
 * receive, converted losslessly by `formatArg`.
 */
type ConsoleArg = string | number | boolean | null | undefined | object;

/** Serialization cap per log line — a runaway `console.log(bigObject)` must not bloat memory. */
const MAX_LOG_MESSAGE_CHARS = 1000;

/** Masks email local-parts in captured output (same policy as body sanitizing). */
const EMAIL_MASK_PATTERN = /([a-zA-Z0-9._%+-])[^@\s]{1,24}@/g;

/** Converts one console argument to text without ever throwing. */
function formatArg(arg: ConsoleArg): string {
	if (arg === null) {
		return "null";
	}
	if (arg === undefined) {
		return "undefined";
	}
	if (typeof arg === "string") {
		return arg;
	}
	if (typeof arg === "number" || typeof arg === "boolean") {
		return String(arg);
	}
	// object (includes arrays, Errors, plain objects)
	if (arg instanceof Error) {
		return `${arg.name}: ${arg.message}`;
	}
	try {
		return JSON.stringify(arg);
	} catch {
		// String(arg) would fall back to Object's default "[object Object]" —
		// a stable marker is more honest for the log line.
		return "[unserializable object]";
	}
}

/**
 * Improvement 16 — per-request console capture.
 *
 * Wraps the global `console.*` methods ONCE at module init (process lifetime,
 * never restored — this is a dev tool and the overhead is one ALS read per
 * call). Every log emitted while a CAPTURED request's async context is active
 * is appended to that request's `SpanStore.logs`; the interceptor persists
 * them on the RequestLog entry. Logs emitted outside any request (or for
 * sampled-out requests) pass through untouched.
 */
@Injectable()
export class TelescopeConsoleCapture implements OnModuleInit {
	public constructor(@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions) {}

	public onModuleInit(): void {
		// Fail-closed: the global console is ONLY wrapped while Telescope is
		// enabled. When disabled (production), the originals stay untouched.
		if (!this.options.enabled) {
			return;
		}
		// Keep the originals so captured output still reaches the real console.
		const originalLog: typeof console.log = console.log.bind(console);
		const originalWarn: typeof console.warn = console.warn.bind(console);
		const originalError: typeof console.error = console.error.bind(console);
		const originalInfo: typeof console.info = console.info.bind(console);
		const originalDebug: typeof console.debug = console.debug.bind(console);

		const capture =
			(level: TelescopeLogLevel, original: (...args: ConsoleArg[]) => void) =>
			(...args: ConsoleArg[]): void => {
				// Capture must never break app logging (guiding principle 3: invisible
				// by default) — a failure in serialization/masking degrades to a warn,
				// and the original call always runs.
				try {
					this.record(level, args);
				} catch {
					// Intentionally silent: the fallthrough is the real console call.
				}
				original(...args);
			};

		console.log = capture("info", originalLog);
		console.warn = capture("warn", originalWarn);
		console.error = capture("error", originalError);
		console.info = capture("info", originalInfo);
		console.debug = capture("debug", originalDebug);
	}

	private record(level: TelescopeLogLevel, args: readonly ConsoleArg[]): void {
		const store: SpanStore | undefined = RequestSpanContext.getStore();
		if (store?.captured !== true) {
			return;
		}
		// Improvement 14 — per-request console budget: once the cap is reached,
		// drop the oldest lines so the newest output stays visible.
		if (store.logs.length >= this.options.maxConsoleEntriesPerRequest) {
			store.logs.shift();
		}
		const raw: string = args.map(formatArg).join(" ").slice(0, MAX_LOG_MESSAGE_CHARS);
		const masked: string = raw.replace(EMAIL_MASK_PATTERN, "$1***@");
		store.logs.push({ level, message: masked, timestamp: nowEpochMs() });
	}
}
