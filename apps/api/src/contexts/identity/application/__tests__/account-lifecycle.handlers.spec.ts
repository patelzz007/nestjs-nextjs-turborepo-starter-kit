import { beforeEach, describe, expect, it } from "vitest";
import { OwnProfileSchema, epochMs } from "@workspace/shared";

import { UserProfile } from "../../domain/aggregates/user-profile.aggregate";
import { AccountNotFoundError, ProfileUpdateDuringImpersonationError } from "../../domain/errors/identity.errors";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { LockoutState } from "../../domain/value-objects/lockout-state.value-object";
import { ResendVerificationEmailCommand } from "../commands/resend-verification-email/resend-verification-email.command";
import { ResendVerificationEmailHandler } from "../commands/resend-verification-email/resend-verification-email.handler";
import { GENERIC_SIGNUP_RESPONSE, SignUpHandler } from "../commands/sign-up/sign-up.handler";
import { SignUpCommand } from "../commands/sign-up/sign-up.command";
import { UnlockAccountCommand } from "../commands/unlock-account/unlock-account.command";
import { UnlockAccountHandler } from "../commands/unlock-account/unlock-account.handler";
import { UpdateOwnProfileCommand } from "../commands/update-own-profile/update-own-profile.command";
import { UpdateOwnProfileHandler } from "../commands/update-own-profile/update-own-profile.handler";
import { VerifyEmailCommand } from "../commands/verify-email/verify-email.command";
import { VerifyEmailHandler } from "../commands/verify-email/verify-email.handler";
import {
	FakeCredentialCrypto,
	FakeIdentityTokens,
	FixedClock,
	InMemoryIdentityStore,
	NOW,
	RecordingFlowSubject,
	ScriptedSignupReferralCodes,
	SequentialIds,
	TEST_SETTINGS,
	accountState,
	anonymousActor,
	userActor,
} from "./fakes/identity.fakes";

const NEW_EMAIL = "new@example.com";

let store: InMemoryIdentityStore;
let clock: FixedClock;
let flow: RecordingFlowSubject;
let referralCodes: ScriptedSignupReferralCodes;
const tokens = new FakeIdentityTokens();

beforeEach(() => {
	store = new InMemoryIdentityStore();
	clock = new FixedClock();
	flow = new RecordingFlowSubject();
	referralCodes = new ScriptedSignupReferralCodes();
	store.accounts.seed(accountState({ id: "user-1", email: EmailAddress.of("jane@example.com") }));
});

describe("SignUpHandler", () => {
	function signUp(email: string, referralCode?: string): ReturnType<SignUpHandler["execute"]> {
		return new SignUpHandler(store.uow, referralCodes, new FakeCredentialCrypto(), tokens, new SequentialIds("new-user"), flow, TEST_SETTINGS, clock).execute(
			new SignUpCommand(anonymousActor(), {
				body: { email, password: "Correct-Horse-1", fullName: "New Person", ...(referralCode === undefined ? {} : { referralCode }) },
				clientType: "web",
			}),
		);
	}

	it("creates the account with its MFA grace period, first referral code, default role and verification email in one write", async () => {
		await expect(signUp(NEW_EMAIL)).resolves.toEqual(GENERIC_SIGNUP_RESPONSE);

		expect(store.accounts.rows.get("user-1")?.email.value).toBe("jane@example.com");
		const created = [...store.accounts.rows.values()].find((row) => row.email.value === NEW_EMAIL);
		expect(created).toMatchObject({ id: "new-user-1", emailVerifiedAt: null, mfaEnrollmentDeadline: NOW + TEST_SETTINGS.mfaEnrollmentGraceMs });
		expect(store.signupReferrals.firstCodes).toHaveLength(1);
		expect(store.roles.consumers).toHaveLength(1);
		expect(store.emails.sent).toEqual([{ kind: "verification", to: NEW_EMAIL, detail: `verify:${NEW_EMAIL}` }]);
		expect(flow.identified).toHaveLength(1);
	});

	it("attaches an accepted referral code to the new account", async () => {
		referralCodes.accepted.set("FRIEND-1", { canonical: "FRIEND1", referrerUserId: "user-1", referralCodeId: "code-1" });

		await signUp(NEW_EMAIL, "FRIEND-1");

		expect(store.signupReferrals.attached).toEqual([expect.objectContaining({ accepted: { canonical: "FRIEND1", referrerUserId: "user-1", referralCodeId: "code-1" } })]);
	});

	it("answers a taken address exactly like a new one, creating and sending nothing (ADR 035)", async () => {
		await expect(signUp("jane@example.com")).resolves.toEqual(GENERIC_SIGNUP_RESPONSE);

		expect(store.accounts.rows.size).toBe(1);
		expect(store.emails.sent).toEqual([]);
	});

	it("refuses a bad referral code before the taken-email disguise", async () => {
		await expect(signUp("jane@example.com", "BOGUS")).rejects.toThrow("referral code BOGUS is invalid");
	});
});

describe("Email verification", () => {
	beforeEach(() => {
		store.accounts.seed(accountState({ id: "user-2", email: EmailAddress.of(NEW_EMAIL), emailVerifiedAt: null }));
	});

	it("verifies once and answers already-verified afterwards", async () => {
		const handler = new VerifyEmailHandler(store.uow, tokens, flow, clock);

		const first = await handler.execute(new VerifyEmailCommand(anonymousActor(), { token: `verify:${NEW_EMAIL}` }));
		const second = await handler.execute(new VerifyEmailCommand(anonymousActor(), { token: `verify:${NEW_EMAIL}` }));

		expect(first).not.toEqual(second);
		expect(store.accounts.rows.get("user-2")?.emailVerifiedAt).toBe(NOW);
		expect(flow.identified).toEqual(["user-2", "user-2"]);
	});

	it("refuses a token for an address that has no account", async () => {
		await expect(
			new VerifyEmailHandler(store.uow, tokens, flow, clock).execute(new VerifyEmailCommand(anonymousActor(), { token: "verify:ghost@example.com" })),
		).rejects.toBeInstanceOf(AccountNotFoundError);
	});

	it("resends only to an account still awaiting verification, answering the same either way", async () => {
		const handler = new ResendVerificationEmailHandler(store.uow, tokens);

		const unverified = await handler.execute(new ResendVerificationEmailCommand(anonymousActor(), { email: NEW_EMAIL, clientType: "web" }));
		const verified = await handler.execute(new ResendVerificationEmailCommand(anonymousActor(), { email: "jane@example.com", clientType: "web" }));
		const unknown = await handler.execute(new ResendVerificationEmailCommand(anonymousActor(), { email: "ghost@example.com", clientType: "web" }));

		expect(new Set([unverified.message, verified.message, unknown.message]).size).toBe(1);
		expect(store.emails.sent.map((email) => email.to)).toEqual([NEW_EMAIL]);
	});
});

describe("UnlockAccountHandler", () => {
	it("clears the lockout and records the credential change", async () => {
		store.accounts.seed(accountState({ id: "user-1", email: EmailAddress.of("jane@example.com"), lockout: LockoutState.of(5, epochMs(NOW + 60_000)) }));

		await new UnlockAccountHandler(store.uow, clock).execute(new UnlockAccountCommand(userActor("admin-1", { isSuperAdmin: true }), { userId: "user-1" }));

		expect(store.accounts.rows.get("user-1")?.lockout).toEqual(LockoutState.clear());
		expect(store.eventNames()).toEqual(["identity.UserCredentialsChanged"]);
		await expect(new UnlockAccountHandler(store.uow, clock).execute(new UnlockAccountCommand(userActor("admin-1"), { userId: "ghost" }))).rejects.toBeInstanceOf(
			AccountNotFoundError,
		);
	});
});

describe("UpdateOwnProfileHandler", () => {
	const PROFILE_USER_ID = "11111111-1111-4111-8111-111111111111";
	const UPDATED = OwnProfileSchema.parse({
		id: PROFILE_USER_ID,
		email: "jane@example.com",
		fullName: "Jane Q. Doe",
		avatar: null,
		version: 4,
		createdAt: NOW,
		updatedAt: NOW,
	});

	it("edits against the client's version and audits the request with the stored profile", async () => {
		store.profiles.profiles.set(PROFILE_USER_ID, UserProfile.rehydrate({ userId: PROFILE_USER_ID, fullName: "Jane Doe", version: 3 }));
		store.profiles.reads.set(PROFILE_USER_ID, UPDATED);

		await expect(
			new UpdateOwnProfileHandler(store.uow, clock).execute(
				new UpdateOwnProfileCommand(userActor(PROFILE_USER_ID), { userId: PROFILE_USER_ID, isImpersonating: false, body: { version: 3, fullName: "Jane Q. Doe" } }),
			),
		).resolves.toEqual(UPDATED);

		expect(store.profiles.saved.at(0)?.changes).toEqual({ fullName: "Jane Q. Doe" });
		expect(store.requestAudit.bodies).toEqual([UPDATED]);
	});

	it("refuses an impersonation session before touching anything", async () => {
		await expect(
			new UpdateOwnProfileHandler(store.uow, clock).execute(
				new UpdateOwnProfileCommand(userActor(PROFILE_USER_ID), { userId: PROFILE_USER_ID, isImpersonating: true, body: { version: 3, fullName: "X" } }),
			),
		).rejects.toBeInstanceOf(ProfileUpdateDuringImpersonationError);
		expect(store.uow.committed).toEqual([]);
	});
});
