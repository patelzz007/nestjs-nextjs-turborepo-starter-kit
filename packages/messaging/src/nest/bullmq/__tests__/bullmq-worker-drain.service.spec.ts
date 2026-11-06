import { WorkerHost } from "@nestjs/bullmq";
import { Worker } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { BullMqWorkerDrainService, type ProviderSource } from "../bullmq-worker-drain.service";

// BullMQ's real Worker opens its own Redis connection as soon as it is built, even with `lazyConnect`. The drain
// only has to CALL `close`, so this Worker has nothing but `close`: no connection, nothing logging after the test ends.
const close = vi.hoisted(() => vi.fn((): Promise<void> => Promise.resolve()));

vi.mock("bullmq", async (importOriginal) => ({
	...(await importOriginal<typeof import("bullmq")>()),
	Worker: class {
		public readonly close = close;
	},
}));

const worker = new Worker("drain-probe");

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
	it("closes the worker of every BullMQ processor and ignores everything else", async () => {
		const drain = new BullMqWorkerDrainService(providers(new ProbeProcessor(), new UnrelatedService(), null, undefined));

		await expect(drain.drain()).resolves.toBe(1);
		expect(close).toHaveBeenCalledOnce();
	});

	it("resolves to 0 when there are no processors (BullMQ disabled)", async () => {
		await expect(new BullMqWorkerDrainService(providers(new UnrelatedService())).drain()).resolves.toBe(0);
	});
});
