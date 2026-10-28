import { epochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { MerchantVerification } from "../../domain/aggregates/merchant-verification.aggregate";
import { KybTransitionNotAllowedError } from "../../domain/errors/tenants.errors";
import type { MerchantVerificationRepository } from "../../domain/repositories/merchant-verification.repository";
import { DecideKybCommand } from "../commands/decide-kyb/decide-kyb.command";
import { DecideKybHandler, type KybDecisionScope } from "../commands/decide-kyb/decide-kyb.handler";
import type { TenantAuditEntry } from "../ports/tenant-audit.port";

const TENANT_ID = "0199a1b2-0000-7000-8000-000000000001";
const ADMIN_ID = "0199a1b2-0000-7000-8000-000000000009";
const NOW = epochMs(1_792_368_000_000);
const REASON = "The registration certificate is unreadable.";
const ACTOR: ActorContext = {
	kind: "user",
	userId: ADMIN_ID,
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: true,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
};

/** What a committed unit of work left behind. */
interface Committed {
	readonly statuses: string[];
	readonly audit: TenantAuditEntry[];
}

/**
 * A transactional fake: writes made inside `work` are buffered and only reach `committed` when `work`
 * resolves — a throw anywhere discards them, as a rolled-back transaction would.
 */
class TransactionalFakeUnitOfWork implements UnitOfWork<KybDecisionScope> {
	public readonly committed: Committed = { statuses: [], audit: [] };
	public saveFails = false;

	public constructor(private readonly stored: { status: string }) {}

	public run<TResult>(_actor: ActorContext, work: (scope: KybDecisionScope) => Promise<TResult>): Promise<TResult> {
		return this.transaction(work);
	}

	public runSystemOperation<TResult>(_operation: string, _actor: ActorContext, work: (scope: KybDecisionScope) => Promise<TResult>): Promise<TResult> {
		return this.transaction(work);
	}

	private async transaction<TResult>(work: (scope: KybDecisionScope) => Promise<TResult>): Promise<TResult> {
		const pending: Committed = { statuses: [], audit: [] };
		const verifications: MerchantVerificationRepository = {
			getForUpdate: (tenantId) => Promise.resolve(MerchantVerification.rehydrate({ tenantId, kybStatus: this.stored.status })),
			activeEvidenceFileIds: () => Promise.resolve([]),
			save: (verification) => {
				if (this.saveFails) {
					return Promise.reject(new Error("compare-and-set lost"));
				}
				pending.statuses.push(verification.currentStatus);
				return Promise.resolve();
			},
		};
		const scope: KybDecisionScope = {
			merchantVerifications: verifications,
			audit: {
				record: (entry: TenantAuditEntry): Promise<void> => {
					pending.audit.push(entry);
					return Promise.resolve();
				},
			},
			events: new TransactionalEventCollector(),
		};
		const result = await work(scope);
		this.committed.statuses.push(...pending.statuses);
		this.committed.audit.push(...pending.audit);
		const [latest] = pending.statuses.slice(-1);
		if (latest !== undefined) {
			this.stored.status = latest;
		}
		return result;
	}
}

const CLOCK: Clock = { now: () => NOW };

function decide(uow: TransactionalFakeUnitOfWork, kybStatus: "APPROVED" | "REJECTED" | "ACTION_REQUIRED" | "PENDING"): Promise<void> {
	return new DecideKybHandler(uow, CLOCK).execute(
		new DecideKybCommand(ACTOR, { tenantId: TENANT_ID, kybStatus, ...(kybStatus === "APPROVED" ? {} : { kybFields: { rejectionReason: REASON } }) }),
	);
}

describe("DecideKybHandler (D05)", () => {
	it("stores the decision and its tenant audit row in the same unit of work", async () => {
		const uow = new TransactionalFakeUnitOfWork({ status: "PENDING" });
		await decide(uow, "REJECTED");
		expect(uow.committed.statuses).toEqual(["REJECTED"]);
		expect(uow.committed.audit).toEqual([
			{
				tenantId: TENANT_ID,
				actorUserId: ADMIN_ID,
				action: "merchant.kyb_decided",
				resourceType: "TenantMerchantProfile",
				resourceId: TENANT_ID,
				metadata: { from: "PENDING", to: "REJECTED", reason: REASON },
			},
		]);
	});

	it("refuses a forbidden transition with nothing stored and no audit row", async () => {
		const uow = new TransactionalFakeUnitOfWork({ status: "REJECTED" });
		await expect(decide(uow, "APPROVED")).rejects.toThrow(KybTransitionNotAllowedError);
		expect(uow.committed).toEqual({ statuses: [], audit: [] });
	});

	it("leaves no audit row when the compare-and-set loses (D06: the audit commits with the change or not at all)", async () => {
		const uow = new TransactionalFakeUnitOfWork({ status: "PENDING" });
		uow.saveFails = true;
		await expect(decide(uow, "APPROVED")).rejects.toThrow("compare-and-set lost");
		expect(uow.committed).toEqual({ statuses: [], audit: [] });
	});
});
