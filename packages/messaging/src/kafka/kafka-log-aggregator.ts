import { z } from "zod";

import type { KafkaLogContext, KafkaLogSink } from "./kafka-client-config";

/** Default aggregation window: one line per distinct client diagnostic per minute, plus its repeat count. */
export const DEFAULT_KAFKA_LOG_AGGREGATION_WINDOW_MS = 60_000;

/**
 * Upper bound on distinct diagnostics aggregated at once. Past it a line is
 * forwarded as-is (never dropped), so a flood of unique messages cannot grow
 * the tracking map without bound.
 */
export const MAX_AGGREGATED_KAFKA_LOG_KEYS = 256;

const KafkaLogAggregationOptionsSchema = z.object({
	/** Length of one aggregation window, in ms (≥ 1 s). */
	windowMs: z.number().int().min(1_000),
	/** Distinct diagnostics tracked at once. */
	maxTrackedKeys: z.number().int().positive(),
});

/** Options of {@link AggregatingKafkaLogSink}. */
export type KafkaLogAggregationOptions = z.input<typeof KafkaLogAggregationOptionsSchema>;

type KafkaLogLevel = keyof KafkaLogSink;

interface PendingRepeats {
	readonly level: KafkaLogLevel;
	readonly message: string;
	readonly context: KafkaLogContext;
	count: number;
	readonly timer: NodeJS.Timeout;
}

/** Identity of a diagnostic: level + client + client event + message (which names the broker). */
export function kafkaLogKey(level: KafkaLogLevel, message: string, context: KafkaLogContext): string {
	return JSON.stringify([level, context.namespace, context.clientEvent, message]);
}

/**
 * Sink decorator that collapses the client's retry storms (a broker that is
 * down fails the same way on every reconnect attempt) into:
 *
 * 1. the FIRST occurrence, forwarded immediately and unchanged; then
 * 2. at the end of the window, ONE line with the same level, message and
 *    context plus `repeats: { count, windowMs }` — only if it repeated.
 *
 * Nothing is dropped: every suppressed line is accounted for in a count, and
 * {@link dispose} flushes the pending counts (call it when the client shuts
 * down). Timers are unref'd, so aggregation never keeps the process alive.
 */
export class AggregatingKafkaLogSink implements KafkaLogSink {
	private readonly _windowMs: number;
	private readonly _maxTrackedKeys: number;
	private readonly _pending: Map<string, PendingRepeats> = new Map<string, PendingRepeats>();

	public constructor(
		private readonly _inner: KafkaLogSink,
		options: KafkaLogAggregationOptions = { windowMs: DEFAULT_KAFKA_LOG_AGGREGATION_WINDOW_MS, maxTrackedKeys: MAX_AGGREGATED_KAFKA_LOG_KEYS },
	) {
		const parsed = KafkaLogAggregationOptionsSchema.parse(options);
		this._windowMs = parsed.windowMs;
		this._maxTrackedKeys = parsed.maxTrackedKeys;
	}

	public error(message: string, context: KafkaLogContext): void {
		this.record("error", message, context);
	}

	public warn(message: string, context: KafkaLogContext): void {
		this.record("warn", message, context);
	}

	public info(message: string, context: KafkaLogContext): void {
		this.record("info", message, context);
	}

	public debug(message: string, context: KafkaLogContext): void {
		this.record("debug", message, context);
	}

	/** Diagnostics currently inside an open window (for tests and health introspection). */
	public trackedKeyCount(): number {
		return this._pending.size;
	}

	/** Emits every pending repeat count now and stops all timers. Idempotent. */
	public dispose(): void {
		for (const key of [...this._pending.keys()]) {
			this.closeWindow(key);
		}
	}

	private record(level: KafkaLogLevel, message: string, context: KafkaLogContext): void {
		const key = kafkaLogKey(level, message, context);
		const open = this._pending.get(key);
		if (open !== undefined) {
			open.count += 1;
			return;
		}
		this._inner[level](message, context);
		if (this._pending.size >= this._maxTrackedKeys) {
			return;
		}
		const timer = setTimeout((): void => {
			this.closeWindow(key);
		}, this._windowMs);
		timer.unref();
		this._pending.set(key, { level, message, context, count: 0, timer });
	}

	private closeWindow(key: string): void {
		const open = this._pending.get(key);
		if (open === undefined) {
			return;
		}
		clearTimeout(open.timer);
		this._pending.delete(key);
		if (open.count > 0) {
			this._inner[open.level](open.message, { ...open.context, repeats: { count: open.count, windowMs: this._windowMs } });
		}
	}
}
