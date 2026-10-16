import { WorkerHost } from "@nestjs/bullmq";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, describe, expect, it, vi } from "vitest";

import { BullMqWorkerDrainService, type ProviderSource } from "./bullmq-worker-drain.service";

// A real Worker that never touches Redis: lazy connection, no autorun, and
// `close` stubbed — the drain only has to CALL it.
const connection = new Redis({ lazyConnect: true, maxRetriesPerRequest: null });
const worker = new Worker("drain-probe", (): Promise<void> => Promise.resolve(), { connection, autorun: false });
const close = vi.spyOn(worker, "close").mockResolvedValue();

class ProbeProcessor extends WorkerHost {
	public override get worker(): Worker {
		return worker;
	}

	public process(): Promise<void> {
		return Promise.resolve();
	}
}

/** A plain provider: must be ignored by the drain. */
class UnrelatedService {
	public readonly name: string = "unrelated";
}

function providers(...instances: (object | null | undefined)[]): ProviderSource {
	return { getProviders: (): readonly { readonly instance: object | null | undefined }[] => instances.map((instance) => ({ instance })) };
}

describe("BullMqWorkerDrainService", () => {
	afterAll(() => {
		connection.disconnect();
	});

	it("closes the worker of every BullMQ processor and ignores everything else", async () => {
		const drain = new BullMqWorkerDrainService(providers(new ProbeProcessor(), new UnrelatedService(), null, undefined));

		await expect(drain.drain()).resolves.toBe(1);
		expect(close).toHaveBeenCalledOnce();
	});

	it("resolves to 0 when there are no processors (BullMQ disabled)", async () => {
		await expect(new BullMqWorkerDrainService(providers(new UnrelatedService())).drain()).resolves.toBe(0);
	});
});
