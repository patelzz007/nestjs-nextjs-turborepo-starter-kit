import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KAFKA_BROKER_FAILED_EVENT, type KafkaLogContext, type KafkaLogSink } from "../kafka-client-config";
import { AggregatingKafkaLogSink, kafkaLogKey } from "../kafka-log-aggregator";

interface CapturedLine {
	readonly level: "error" | "warn" | "info" | "debug";
	readonly message: string;
	readonly context: KafkaLogContext;
}

function capturingSink(lines: CapturedLine[]): KafkaLogSink {
	return {
		error: (message: string, context: KafkaLogContext): void => {
			lines.push({ level: "error", message, context });
		},
		warn: (message: string, context: KafkaLogContext): void => {
			lines.push({ level: "warn", message, context });
		},
		info: (message: string, context: KafkaLogContext): void => {
			lines.push({ level: "info", message, context });
		},
		debug: (message: string, context: KafkaLogContext): void => {
			lines.push({ level: "debug", message, context });
		},
	};
}

const WINDOW_MS = 10_000;
const BROKER_FAILED: KafkaLogContext = { namespace: "producer", clientEvent: KAFKA_BROKER_FAILED_EVENT, repeats: null };
const BROKER_DOWN = "Connection to broker 127.0.0.1:9092 failed";
const ATTEMPTS = 40;
const ATTEMPT_INTERVAL_MS = 200;

describe("AggregatingKafkaLogSink", () => {
	let lines: CapturedLine[];
	let sink: AggregatingKafkaLogSink;

	beforeEach(() => {
		vi.useFakeTimers();
		lines = [];
		sink = new AggregatingKafkaLogSink(capturingSink(lines), { windowMs: WINDOW_MS, maxTrackedKeys: 4 });
	});

	afterEach(() => {
		sink.dispose();
		vi.useRealTimers();
	});

	it("forwards the first occurrence immediately and unchanged", () => {
		sink.warn(BROKER_DOWN, BROKER_FAILED);

		expect(lines).toEqual([{ level: "warn", message: BROKER_DOWN, context: BROKER_FAILED }]);
	});

	it("collapses a retry storm into the first line plus ONE summary line with the repeat count at the end of the window", () => {
		sink.warn(BROKER_DOWN, BROKER_FAILED);
		for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
			vi.advanceTimersByTime(ATTEMPT_INTERVAL_MS);
			sink.warn(BROKER_DOWN, BROKER_FAILED);
		}
		expect(lines).toHaveLength(1);

		vi.advanceTimersByTime(WINDOW_MS);

		expect(lines).toEqual([
			{ level: "warn", message: BROKER_DOWN, context: BROKER_FAILED },
			{ level: "warn", message: BROKER_DOWN, context: { ...BROKER_FAILED, repeats: { count: ATTEMPTS, windowMs: WINDOW_MS } } },
		]);
		expect(sink.trackedKeyCount()).toBe(0);
	});

	it("emits no summary for a diagnostic that did not repeat", () => {
		sink.warn(BROKER_DOWN, BROKER_FAILED);
		vi.advanceTimersByTime(WINDOW_MS);

		expect(lines).toHaveLength(1);
	});

	it("starts a fresh window once the previous one closed", () => {
		sink.warn(BROKER_DOWN, BROKER_FAILED);
		vi.advanceTimersByTime(WINDOW_MS);
		sink.warn(BROKER_DOWN, BROKER_FAILED);

		expect(lines.map((line) => line.message)).toEqual([BROKER_DOWN, BROKER_DOWN]);
	});

	it("keeps distinct diagnostics (level, client, client event, broker) apart", () => {
		sink.warn(BROKER_DOWN, BROKER_FAILED);
		sink.error(BROKER_DOWN, BROKER_FAILED);
		sink.warn(BROKER_DOWN, { ...BROKER_FAILED, namespace: "admin" });
		sink.warn(BROKER_DOWN, { ...BROKER_FAILED, clientEvent: "error" });
		sink.warn("Connection to broker 127.0.0.1:9093 failed", BROKER_FAILED);

		expect(lines).toHaveLength(5);
	});

	it("never drops: dispose() flushes every pending repeat count", () => {
		sink.warn(BROKER_DOWN, BROKER_FAILED);
		sink.warn(BROKER_DOWN, BROKER_FAILED);
		sink.warn(BROKER_DOWN, BROKER_FAILED);

		sink.dispose();

		expect(lines.at(-1)).toEqual({ level: "warn", message: BROKER_DOWN, context: { ...BROKER_FAILED, repeats: { count: 2, windowMs: WINDOW_MS } } });
		vi.advanceTimersByTime(WINDOW_MS);
		expect(lines).toHaveLength(2);
	});

	it("forwards every line unaggregated once the tracking bound is reached — bounded memory, nothing lost", () => {
		for (let broker = 0; broker < 4; broker += 1) {
			sink.warn(`broker ${String(broker)} down`, BROKER_FAILED);
		}
		sink.warn("broker 9 down", BROKER_FAILED);
		sink.warn("broker 9 down", BROKER_FAILED);

		expect(sink.trackedKeyCount()).toBe(4);
		expect(lines.map((line) => line.message).slice(-2)).toEqual(["broker 9 down", "broker 9 down"]);
	});

	it("rejects an invalid window instead of silently using it", () => {
		expect(() => new AggregatingKafkaLogSink(capturingSink([]), { windowMs: 0, maxTrackedKeys: 1 })).toThrow();
		expect(() => new AggregatingKafkaLogSink(capturingSink([]), { windowMs: WINDOW_MS, maxTrackedKeys: 0 })).toThrow();
	});
});

describe("kafkaLogKey", () => {
	it("is the same for the same failure of the same broker", () => {
		expect(kafkaLogKey("warn", BROKER_DOWN, BROKER_FAILED)).toBe(kafkaLogKey("warn", BROKER_DOWN, { ...BROKER_FAILED }));
	});

	it("ignores the repeat count, which only a summary line carries", () => {
		expect(kafkaLogKey("warn", BROKER_DOWN, BROKER_FAILED)).toBe(kafkaLogKey("warn", BROKER_DOWN, { ...BROKER_FAILED, repeats: { count: 3, windowMs: WINDOW_MS } }));
	});
});
