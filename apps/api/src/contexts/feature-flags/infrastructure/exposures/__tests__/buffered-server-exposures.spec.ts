import { EXPOSURE_BATCH_MAX, epochMs } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExposureBatchRecord, ExposureRecorder } from "../../../application/ports/exposure-recorder.port";
import type { ServerExposure } from "../../../application/ports/server-exposures.port";
import { BufferedServerExposures, SERVER_EXPOSURE_DEDUPE_MS, SERVER_EXPOSURE_FLUSH_MS } from "../buffered-server-exposures";

const NOW_MS = 1_790_000_000_000;

/** TEST-ONLY recorder: keeps every batch, and can hold the next one until the test releases it. */
class RecordingRecorder implements ExposureRecorder {
	public readonly batches: ExposureBatchRecord[] = [];
	private held: Promise<void> | null = null;
	private releaseHeld: () => void = (): void => undefined;

	public holdNext(): void {
		this.held = new Promise<void>((resolve): void => {
			this.releaseHeld = resolve;
		});
	}

	public release(): void {
		this.releaseHeld();
	}

	public async record(batch: ExposureBatchRecord): Promise<void> {
		const held = this.held;
		this.held = null;
		if (held !== null) {
			await held;
		}
		this.batches.push(batch);
	}
}

function exposure(subjectId: string): ServerExposure {
	return { kind: "FLAG", key: "till-redemption", on: true, source: "RULE", revision: 1, ruleId: null, at: epochMs(NOW_MS), subjectUnit: "LOCATION", subjectId };
}

function subjects(batches: readonly ExposureBatchRecord[]): readonly string[] {
	return batches.flatMap((batch) => batch.exposures.map((noted) => noted.subjectId));
}

describe("BufferedServerExposures", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("notes one decision per subject per hour, and sends what is pending on the next flush", async () => {
		vi.useFakeTimers();
		let now = NOW_MS;
		const recorder = new RecordingRecorder();
		const exposures = new BufferedServerExposures(recorder, () => now);

		exposures.note(exposure("store-1"));
		exposures.note(exposure("store-1"));
		exposures.note(exposure("store-2"));
		await vi.advanceTimersByTimeAsync(SERVER_EXPOSURE_FLUSH_MS);
		expect(subjects(recorder.batches)).toStrictEqual(["store-1", "store-2"]);
		expect(recorder.batches.at(0)?.app).toBe("api");

		now += SERVER_EXPOSURE_DEDUPE_MS;
		exposures.note(exposure("store-1"));
		await vi.advanceTimersByTimeAsync(SERVER_EXPOSURE_FLUSH_MS);
		expect(subjects(recorder.batches)).toStrictEqual(["store-1", "store-2", "store-1"]);
		await exposures.onApplicationShutdown();
	});

	it("sends a full batch at once, without waiting for the timer", async () => {
		const recorder = new RecordingRecorder();
		const exposures = new BufferedServerExposures(recorder, () => NOW_MS);

		for (const index of Array.from({ length: EXPOSURE_BATCH_MAX }, (_unused, position) => position)) {
			exposures.note(exposure(`store-${String(index)}`));
		}
		await exposures.onApplicationShutdown();

		expect(recorder.batches).toHaveLength(1);
		expect(recorder.batches.at(0)?.exposures).toHaveLength(EXPOSURE_BATCH_MAX);
	});

	it("on shutdown waits for a flush in progress, then sends whatever is still pending", async () => {
		vi.useFakeTimers();
		const recorder = new RecordingRecorder();
		const exposures = new BufferedServerExposures(recorder, () => NOW_MS);
		exposures.note(exposure("store-1"));
		recorder.holdNext();
		await vi.advanceTimersByTimeAsync(SERVER_EXPOSURE_FLUSH_MS);
		exposures.note(exposure("store-2"));

		let shutDown = false;
		const shutdown = exposures.onApplicationShutdown().then((): void => {
			shutDown = true;
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(shutDown).toBe(false);
		expect(recorder.batches).toHaveLength(0);

		recorder.release();
		await shutdown;
		expect(subjects(recorder.batches)).toStrictEqual(["store-1", "store-2"]);
	});
});
