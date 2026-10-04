import { describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { MissingTransactionCorrelationIdError } from "../../../prisma/transaction-correlation";
import { OrganizationLifecycleEventRecorder } from "./organization-lifecycle-event.recorder";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const ORG_ID = "6f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const ACTOR_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

interface FakeLifecycleTransaction {
	organizationLifecycleEvent: { create: ReturnType<typeof vi.fn> };
	$queryRaw: ReturnType<typeof vi.fn>;
}

/** A fake transaction (the delegate mocks on top of a module-mocked, connection-less PrismaService) plus its `create` mock. */
function createTx(correlationId: string | null): { readonly tx: PrismaService & FakeLifecycleTransaction; readonly create: ReturnType<typeof vi.fn> } {
	const create = vi.fn().mockResolvedValue({});
	const fake: FakeLifecycleTransaction = {
		organizationLifecycleEvent: { create },
		$queryRaw: vi.fn().mockResolvedValue([{ correlation_id: correlationId }]),
	};
	return { tx: Object.assign(new PrismaService(createTestTypedConfig()), fake), create };
}

describe("OrganizationLifecycleEventRecorder", () => {
	const recorder = new OrganizationLifecycleEventRecorder();

	it("stamps the transaction's correlation id on the lifecycle event", async () => {
		const { tx, create } = createTx("req-lifecycle-42");

		await recorder.recordInTx(tx, { organizationId: ORG_ID, fromState: "ACTIVE", toState: "SUSPENDED", actorUserId: ACTOR_ID, reason: "Chargeback fraud" });

		expect(create).toHaveBeenCalledWith({
			data: {
				organizationId: ORG_ID,
				fromState: "ACTIVE",
				toState: "SUSPENDED",
				actorUserId: ACTOR_ID,
				reason: "Chargeback fraud",
				correlationId: "req-lifecycle-42",
			},
		});
	});

	it("records background transitions (no human actor) under the system operation's correlation id", async () => {
		const { tx, create } = createTx("job-deletion-sweep");

		await recorder.recordInTx(tx, { organizationId: ORG_ID, fromState: "PENDING_DELETION", toState: "DELETED", actorUserId: null, reason: "Grace period elapsed" });

		expect(create.mock.lastCall).toMatchObject([{ data: { actorUserId: null, correlationId: "job-deletion-sweep" } }]);
	});

	it("writes nothing when the transaction carries no correlation id", async () => {
		const { tx, create } = createTx(null);

		await expect(
			recorder.recordInTx(tx, { organizationId: ORG_ID, fromState: "ACTIVE", toState: "RESTRICTED", actorUserId: ACTOR_ID, reason: "KYB lapsed" }),
		).rejects.toBeInstanceOf(MissingTransactionCorrelationIdError);
		expect(create).not.toHaveBeenCalled();
	});
});
