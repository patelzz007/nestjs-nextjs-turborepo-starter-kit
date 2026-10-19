import { epochMs, KybStatusSchema, type KybStatus } from "@workspace/shared";

import { MerchantVerification } from "../aggregates/merchant-verification.aggregate";
import { KybAlreadyApprovedError, KybDecisionReasonRequiredError, KybTransitionNotAllowedError, OrganizationsCorruptStateError } from "../errors/organizations.errors";
import { MerchantVerificationStatusChanged } from "../events/organizations.events";

const ORGANIZATION_ID = "0199a1b2-0000-7000-8000-000000000001";
const NOW = epochMs(1_792_368_000_000);
const REASON = "The registration certificate is unreadable.";

/** The admin decisions the review allows (D05, migration plan §7.5). */
const ALLOWED: ReadonlyMap<KybStatus, readonly KybStatus[]> = new Map<KybStatus, readonly KybStatus[]>([
	["PENDING", ["APPROVED", "REJECTED", "ACTION_REQUIRED"]],
	["ACTION_REQUIRED", ["APPROVED", "REJECTED"]],
	["APPROVED", ["REJECTED", "ACTION_REQUIRED"]],
	["REJECTED", []],
]);

function review(status: KybStatus): MerchantVerification {
	return MerchantVerification.rehydrate({ organizationId: ORGANIZATION_ID, kybStatus: status });
}

const transitions = KybStatusSchema.options.flatMap((from) => KybStatusSchema.options.map((to) => ({ from, to, allowed: ALLOWED.get(from)?.includes(to) === true })));

describe("MerchantVerification admin decision (D05)", () => {
	it.each(transitions.filter((transition) => !transition.allowed))("refuses $from → $to and changes nothing", ({ from, to }) => {
		const verification = review(from);
		expect(() => {
			verification.decide(to, REASON, null, NOW);
		}).toThrow(KybTransitionNotAllowedError);
		expect(verification.currentStatus).toBe(from);
		expect(verification.pullEvents()).toEqual([]);
	});

	it.each(transitions.filter((transition) => transition.allowed))("allows $from → $to and records the change", ({ from, to }) => {
		const verification = review(from);
		verification.decide(to, REASON, { rejectionReason: REASON }, NOW);
		expect(verification.currentStatus).toBe(to);
		expect(verification.concurrencyToken).toBe(from);
		expect(verification.pendingDecisionKybFields).toEqual({ rejectionReason: REASON });
		expect(verification.pullEvents()).toEqual([new MerchantVerificationStatusChanged(NOW, ORGANIZATION_ID, from, to)]);
	});

	it.each<KybStatus>(["REJECTED", "ACTION_REQUIRED"])("needs a reason to decide %s", (to) => {
		expect(() => {
			review("PENDING").decide(to, "   ", null, NOW);
		}).toThrow(KybDecisionReasonRequiredError);
		expect(() => {
			review("PENDING").decide(to, null, null, NOW);
		}).toThrow(KybDecisionReasonRequiredError);
	});

	it("approves without a reason", () => {
		const verification = review("PENDING");
		verification.decide("APPROVED", null, null, NOW);
		expect(verification.currentStatus).toBe("APPROVED");
	});
});

describe("MerchantVerification merchant submission", () => {
	it("refuses a resubmission once approved", () => {
		expect(() => {
			review("APPROVED").submit({ legalName: "Brew", addressText: "KL", contactPhone: "+60123456789", kybFields: {}, category: null }, [], [], NOW);
		}).toThrow(KybAlreadyApprovedError);
	});

	it("reopens a rejected review as PENDING", () => {
		const verification = review("REJECTED");
		verification.submit({ legalName: "Brew", addressText: "KL", contactPhone: "+60123456789", kybFields: {}, category: null }, [], [], NOW);
		expect(verification.currentStatus).toBe("PENDING");
		expect(verification.pendingEvidenceFileIds).toEqual([]);
	});

	it("rejects a stored status outside the enum as corrupt state", () => {
		expect(() => MerchantVerification.rehydrate({ organizationId: ORGANIZATION_ID, kybStatus: "MAYBE" })).toThrow(OrganizationsCorruptStateError);
	});
});
