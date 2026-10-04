import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KafkaLogContext, KafkaLogSink } from "./kafka-client-config";
import { AggregatingKafkaLogSink, kafkaLogKey } from "./kafka-log-aggregator";

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
const FAIL: KafkaLogContext = { namespace: null, facility: "FAIL", repeats: null };
const REFUSED = "[thrd:127.0.0.1:9092/bootstrap]: 127.0.0.1:9092/bootstrap: Connect to ipv4#127.0.0.1:9092 failed: Connection refused";

function refused(afterMs: number, suppressed: number | null = null): string {
	return `${REFUSED} (after ${String(afterMs)}ms in state CONNECT${suppressed === null ? "" : `, ${String(suppressed)} identical error(s) suppressed`})`;
}

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
		sink.error(refused(2), FAIL);

		expect(lines).toEqual([{ level: "error", message: refused(2), context: FAIL }]);
	});

	it("collapses a retry storm into the first line plus ONE summary line with the repeat count at the end of the window", () => {
		sink.error(refused(2), FAIL);
		for (let attempt = 0; attempt < 40; attempt += 1) {
			vi.advanceTimersByTime(200);
			sink.error(refused(attempt, attempt % 3 === 0 ? attempt : null), FAIL);
		}
		expect(lines).toHaveLength(1);

		vi.advanceTimersByTime(WINDOW_MS);

		expect(lines).toEqual([
			{ level: "error", message: refused(2), context: FAIL },
			{ level: "error", message: refused(2), context: { ...FAIL, repeats: { count: 40, windowMs: WINDOW_MS } } },
		]);
		expect(sink.trackedKeyCount()).toBe(0);
	});

	it("emits no summary for a diagnostic that did not repeat", () => {
		sink.warn("slow metadata request", FAIL);
		vi.advanceTimersByTime(WINDOW_MS);

		expect(lines).toHaveLength(1);
	});

	it("starts a fresh window once the previous one closed", () => {
		sink.error(refused(1), FAIL);
		vi.advanceTimersByTime(WINDOW_MS);
		sink.error(refused(3), FAIL);

		expect(lines.map((line) => line.message)).toEqual([refused(1), refused(3)]);
	});

	it("keeps distinct diagnostics (level, facility, namespace, broker) apart", () => {
		sink.error(refused(1), FAIL);
		sink.warn(refused(1), FAIL);
		sink.error(refused(1), { ...FAIL, namespace: "admin" });
		sink.error("Connect to ipv4#127.0.0.1:9093 failed: Connection refused", FAIL);

		expect(lines).toHaveLength(4);
	});

	it("never drops: dispose() flushes every pending repeat count", () => {
		sink.error(refused(1), FAIL);
		sink.error(refused(2), FAIL);
		sink.error(refused(3), FAIL);

		sink.dispose();

		expect(lines.at(-1)).toEqual({ level: "error", message: refused(1), context: { ...FAIL, repeats: { count: 2, windowMs: WINDOW_MS } } });
		vi.advanceTimersByTime(WINDOW_MS);
		expect(lines).toHaveLength(2);
	});

	it("forwards every line unaggregated once the tracking bound is reached — bounded memory, nothing lost", () => {
		for (let broker = 0; broker < 4; broker += 1) {
			sink.error(`broker ${String(broker)} down`, FAIL);
		}
		sink.error("broker 9 down", FAIL);
		sink.error("broker 9 down", FAIL);

		expect(sink.trackedKeyCount()).toBe(4);
		expect(lines.map((line) => line.message).slice(-2)).toEqual(["broker 9 down", "broker 9 down"]);
	});

	it("rejects an invalid window instead of silently using it", () => {
		expect(() => new AggregatingKafkaLogSink(capturingSink([]), { windowMs: 0, maxTrackedKeys: 1 })).toThrow();
		expect(() => new AggregatingKafkaLogSink(capturingSink([]), { windowMs: WINDOW_MS, maxTrackedKeys: 0 })).toThrow();
	});
});

describe("kafkaLogKey", () => {
	it("ignores librdkafka's per-retry timing and suppressed-count details", () => {
		expect(kafkaLogKey("error", refused(2), FAIL)).toBe(kafkaLogKey("error", refused(731, 5), FAIL));
	});

	it("keeps the connection state, which is part of what failed", () => {
		expect(kafkaLogKey("error", `${REFUSED} (after 2ms in state CONNECT)`, FAIL)).not.toBe(kafkaLogKey("error", `${REFUSED} (after 2ms in state APIVERSION_QUERY)`, FAIL));
	});
});
