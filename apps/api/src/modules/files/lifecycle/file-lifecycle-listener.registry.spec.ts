import type { Prisma } from "@prisma/client";
import type { FileCategory } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { FileLifecycleListener, type FileVerdictEvent } from "./file-lifecycle-listener";
import { FileLifecycleListenerRegistry } from "./file-lifecycle-listener.registry";

class RecordingListener extends FileLifecycleListener {
	public readonly received: FileVerdictEvent[] = [];

	public constructor(public readonly categories: readonly FileCategory[]) {
		super();
	}

	public onVerdict(_tx: Prisma.TransactionClient, event: FileVerdictEvent): Promise<void> {
		this.received.push(event);
		return Promise.resolve();
	}
}

const EVENT: FileVerdictEvent = { fileId: "f", category: "MERCHANT_KYB", organizationId: "o", uploadedById: "u", outcome: "QUARANTINED" };

describe("FileLifecycleListenerRegistry", () => {
	it("delivers a verdict only to discovered listeners of the file's category, ignoring every other provider", async () => {
		const kyb = new RecordingListener(["MERCHANT_KYB"]);
		const products = new RecordingListener(["PRODUCT_IMAGE"]);
		const registry = new FileLifecycleListenerRegistry({
			getProviders: (): readonly { readonly instance: object | null | undefined }[] => [
				{ instance: kyb },
				{ instance: products },
				{ instance: {} },
				{ instance: null },
				{ instance: undefined },
			],
		});

		await registry.notifyInTx(createTestPrisma(), EVENT);

		expect(kyb.received).toEqual([EVENT]);
		expect(products.received).toEqual([]);
	});

	it("propagates a listener failure so the verdict transaction rolls back", async () => {
		class FailingListener extends FileLifecycleListener {
			public readonly categories: readonly FileCategory[] = ["MERCHANT_KYB"];

			public onVerdict(): Promise<void> {
				return Promise.reject(new Error("reaction failed"));
			}
		}
		const registry = new FileLifecycleListenerRegistry({ getProviders: (): readonly { readonly instance: object }[] => [{ instance: new FailingListener() }] });

		await expect(registry.notifyInTx(createTestPrisma(), EVENT)).rejects.toThrow("reaction failed");
	});
});
