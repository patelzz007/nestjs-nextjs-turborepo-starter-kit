import { beforeEach, describe, expect, it } from "vitest";
import { epochMs } from "@workspace/shared";

import {
	AccountNotFoundError,
	MfaRecoveryAlreadyOpenError,
	MfaRecoveryNotPendingError,
	MfaRecoveryRequiresTwoFactorError,
	MfaRecoveryReviewerNotEligibleError,
	MfaRecoverySelfReviewError,
} from "../../domain/errors/identity.errors";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { CompleteDueMfaRecoveriesCommand } from "../commands/complete-due-mfa-recoveries/complete-due-mfa-recoveries.command";
import { CompleteDueMfaRecoveriesHandler } from "../commands/complete-due-mfa-recoveries/complete-due-mfa-recoveries.handler";
import { RequestMfaRecoveryCommand } from "../commands/request-mfa-recovery/request-mfa-recovery.command";
import { RequestMfaRecoveryHandler } from "../commands/request-mfa-recovery/request-mfa-recovery.handler";
import { ReviewMfaRecoveryCommand } from "../commands/review-mfa-recovery/review-mfa-recovery.command";
import { ReviewMfaRecoveryHandler } from "../commands/review-mfa-recovery/review-mfa-recovery.handler";
import { FixedClock, InMemoryIdentityStore, NOW, SequentialIds, TEST_SETTINGS, accountState, userActor } from "./fakes/identity.fakes";
import { systemActor } from "../../../../platform/application/actor-context";

const USER_ID = "user-1";
const ADMIN_ID = "admin-1";

let store: InMemoryIdentityStore;
let clock: FixedClock;

beforeEach(() => {
	store = new InMemoryIdentityStore();
	clock = new FixedClock();
	store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of("jane@example.com"), twoFactorEnabled: true }));
	store.accounts.seed(accountState({ id: ADMIN_ID, email: EmailAddress.of("admin@example.com"), isSuperAdmin: true }));
	store.accounts.seed(accountState({ id: "admin-2", email: EmailAddress.of("second-admin@example.com"), isSuperAdmin: true }));
});

function request(userId: string = USER_ID): ReturnType<RequestMfaRecoveryHandler["execute"]> {
	return new RequestMfaRecoveryHandler(store.uow, new SequentialIds("recovery"), clock).execute(
		new RequestMfaRecoveryCommand(userActor(userId), { userId, reason: "lost my phone" }),
	);
}

function review(reviewerId: string, decision: "approve" | "deny", requestId = "recovery-1"): ReturnType<ReviewMfaRecoveryHandler["execute"]> {
	return new ReviewMfaRecoveryHandler(store.uow, TEST_SETTINGS, clock).execute(
		new ReviewMfaRecoveryCommand(userActor(reviewerId, { isSuperAdmin: true }), { reviewerId, requestId, decision, notes: undefined }),
	);
}

function completeDue(): Promise<number> {
	return new CompleteDueMfaRecoveriesHandler(store.uow, clock).execute(
		new CompleteDueMfaRecoveriesCommand(systemActor("maintenance.mfa_recovery_unlock", "cron", null, "unlock due recoveries", null), { reason: "unlock due recoveries" }),
	);
}

describe("RequestMfaRecoveryHandler", () => {
	it("opens one request under the opening lock, tells the user, and tells every active SuperAdmin", async () => {
		await request();

		expect(store.mfaRecoveries.openingLocks).toBe(1);
		expect(store.mfaRecoveries.rows.get("recovery-1")).toMatchObject({ userId: USER_ID, status: "PENDING", notes: "lost my phone" });
		expect(store.mfaRecoveries.audits).toEqual(["mfa_recovery.requested"]);
		expect(store.emails.sent.map((email) => [email.kind, email.to])).toEqual([
			["mfa_recovery_user", "jane@example.com"],
			["mfa_recovery_admin", "admin@example.com"],
			["mfa_recovery_admin", "second-admin@example.com"],
		]);
	});

	it("refuses a second open request, an account without 2FA and an unknown account", async () => {
		await request();

		await expect(request()).rejects.toBeInstanceOf(MfaRecoveryAlreadyOpenError);
		await expect(request(ADMIN_ID)).rejects.toBeInstanceOf(MfaRecoveryRequiresTwoFactorError);
		await expect(request("nobody")).rejects.toBeInstanceOf(AccountNotFoundError);
	});
});

describe("ReviewMfaRecoveryHandler", () => {
	beforeEach(async () => {
		await request();
		store.emails.sent.length = 0;
	});

	it("approves with the security delay and tells the requester when MFA will be cleared", async () => {
		await expect(review(ADMIN_ID, "approve")).resolves.toMatchObject({ status: "APPROVED" });

		expect(store.mfaRecoveries.rows.get("recovery-1")).toMatchObject({ reviewedBy: ADMIN_ID, scheduledUnlockAt: NOW + TEST_SETTINGS.mfaRecoveryDelayMs });
		expect(store.emails.sent).toEqual([{ kind: "mfa_recovery_user", to: "jane@example.com", detail: "MFA Recovery Approved" }]);
	});

	it("lets exactly one review win: a second one finds the request no longer pending", async () => {
		await review(ADMIN_ID, "deny");

		await expect(review("admin-2", "approve")).rejects.toBeInstanceOf(MfaRecoveryNotPendingError);
		expect(store.mfaRecoveries.rows.get("recovery-1")?.status).toBe("DENIED");
	});

	it("refuses a self-review and a reviewer who is not an active SuperAdmin", async () => {
		store.accounts.seed(accountState({ id: "staff-1", email: EmailAddress.of("staff@example.com") }));

		await expect(review(USER_ID, "approve")).rejects.toBeInstanceOf(MfaRecoverySelfReviewError);
		await expect(review("staff-1", "approve")).rejects.toBeInstanceOf(MfaRecoveryReviewerNotEligibleError);
		expect(store.mfaRecoveries.rows.get("recovery-1")?.status).toBe("PENDING");
	});
});

describe("CompleteDueMfaRecoveriesHandler", () => {
	it("completes approved requests once their delay passed, each once, mailing the user", async () => {
		await request();
		await review(ADMIN_ID, "approve");
		store.emails.sent.length = 0;

		await expect(completeDue()).resolves.toBe(0);
		clock.advance(TEST_SETTINGS.mfaRecoveryDelayMs);
		await expect(completeDue()).resolves.toBe(1);
		await expect(completeDue()).resolves.toBe(0);

		expect(store.mfaRecoveries.rows.get("recovery-1")).toMatchObject({ status: "COMPLETED", completedAt: epochMs(NOW + TEST_SETTINGS.mfaRecoveryDelayMs) });
		expect(store.emails.kinds()).toEqual(["two_factor_disabled"]);
		expect(store.eventNames()).toContain("identity.UserCredentialsChanged");
	});
});
