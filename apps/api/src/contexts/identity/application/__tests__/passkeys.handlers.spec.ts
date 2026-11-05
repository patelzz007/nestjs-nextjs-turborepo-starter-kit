import { beforeEach, describe, expect, it } from "vitest";
import {
	MAX_PASSKEYS_PER_ACCOUNT,
	epochMs,
	type Passkey,
	type PasskeyAppAssociations,
	type PasskeyAuthenticationOptions,
	type PasskeyAuthenticationResponse,
	type PasskeyRegistrationOptions,
	type PasskeyRegistrationResponse,
} from "@workspace/shared";

import type { PasskeyAssertion, VerifiedPasskeyCredential } from "../../domain/aggregates/passkey.aggregate";
import { MFA_CHALLENGE_MAX_ATTEMPTS, MFA_CHALLENGE_TTL_MS } from "../../domain/aggregates/two-factor-login-challenge.aggregate";
import { WEB_AUTHN_CHALLENGE_RETENTION_MS, WEB_AUTHN_CHALLENGE_TTL_MS, WebAuthnChallenge } from "../../domain/aggregates/web-authn-challenge.aggregate";
import { TwoFactorEnrollment } from "../../domain/aggregates/two-factor-enrollment.aggregate";
import {
	AccountNotFoundError,
	InvalidCredentialsError,
	NoPasskeyRegisteredError,
	PasskeyAlreadyRegisteredError,
	PasskeyChallengeInvalidError,
	PasskeyChangeDuringImpersonationError,
	PasskeyLimitReachedError,
	PasskeyNotFoundError,
	PasskeyPasswordIncorrectError,
	PasskeyVerificationFailedError,
} from "../../domain/errors/identity.errors";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { LockoutState } from "../../domain/value-objects/lockout-state.value-object";
import { TokenVersion } from "../../domain/value-objects/token-version.value-object";
import { GetPasskeyAppAssociationsHandler } from "../queries/get-passkey-app-associations/get-passkey-app-associations.handler";
import { CompletePasskeyRegistrationCommand } from "../commands/complete-passkey-registration/complete-passkey-registration.command";
import { CompletePasskeyRegistrationHandler } from "../commands/complete-passkey-registration/complete-passkey-registration.handler";
import { CompletePasskeySecondFactorCommand } from "../commands/complete-passkey-second-factor/complete-passkey-second-factor.command";
import { CompletePasskeySecondFactorHandler } from "../commands/complete-passkey-second-factor/complete-passkey-second-factor.handler";
import { CompletePasswordlessPasskeyLoginCommand } from "../commands/complete-passwordless-passkey-login/complete-passwordless-passkey-login.command";
import { CompletePasswordlessPasskeyLoginHandler } from "../commands/complete-passwordless-passkey-login/complete-passwordless-passkey-login.handler";
import { PurgeStaleWebAuthnChallengesCommand } from "../commands/purge-stale-web-authn-challenges/purge-stale-web-authn-challenges.command";
import { PurgeStaleWebAuthnChallengesHandler } from "../commands/purge-stale-web-authn-challenges/purge-stale-web-authn-challenges.handler";
import { RemovePasskeyCommand } from "../commands/remove-passkey/remove-passkey.command";
import { RemovePasskeyHandler } from "../commands/remove-passkey/remove-passkey.handler";
import { RenamePasskeyCommand } from "../commands/rename-passkey/rename-passkey.command";
import { RenamePasskeyHandler } from "../commands/rename-passkey/rename-passkey.handler";
import { StartPasskeyRegistrationCommand } from "../commands/start-passkey-registration/start-passkey-registration.command";
import { StartPasskeyRegistrationHandler } from "../commands/start-passkey-registration/start-passkey-registration.handler";
import { StartPasskeySecondFactorCommand } from "../commands/start-passkey-second-factor/start-passkey-second-factor.command";
import { StartPasskeySecondFactorHandler } from "../commands/start-passkey-second-factor/start-passkey-second-factor.handler";
import { StartPasswordlessPasskeyLoginCommand } from "../commands/start-passwordless-passkey-login/start-passwordless-passkey-login.command";
import { StartPasswordlessPasskeyLoginHandler } from "../commands/start-passwordless-passkey-login/start-passwordless-passkey-login.handler";
import { ListMyPasskeysQuery } from "../queries/list-my-passkeys/list-my-passkeys.query";
import { ListMyPasskeysHandler } from "../queries/list-my-passkeys/list-my-passkeys.handler";
import type { CeremonyVerification, ChallengeCheck, PasskeyAccountRef, PasskeyCredentialRef, StoredPasskeyKey, WebAuthnPort } from "../ports/web-authn.port";
import { MfaLoginCompletion } from "../services/mfa-login-completion";
import { InMemoryIdentityReads } from "./fakes/identity-reads.fakes";
import { signInHarness, type SignInHarness } from "./fakes/identity-sign-in.fakes";
import {
	FakeCredentialCrypto,
	FixedClock,
	FixedGrants,
	InMemoryIdentityStore,
	NOW,
	RecordingFlowSubject,
	SequentialIds,
	TEST_DEVICE,
	accountState,
	anonymousActor,
	passkeyState,
	userActor,
} from "./fakes/identity.fakes";

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const EMAIL = "jane@example.com";
const PASSWORD = "Correct-Horse-1";
const TEMP_TOKEN = "temp-token";
const LOGIN_CHALLENGE_ID = "login-1";
const DEVICE = { device: TEST_DEVICE, ipAddress: null, userAgent: "Firefox" };
const SIGNATURE_OK = "c2lnbmVk";

/**
 * A relying party that signs what it is told to: the challenge it issues counts up, a registration
 * response verifies when its `rawId` is the challenge's answer, an assertion when its signature is
 * {@link SIGNATURE_OK} and it answers the issued challenge.
 */
/** The native apps a deployment shares its passkeys with, as the adapter states them. */
const ASSOCIATIONS: PasskeyAppAssociations = {
	assetLinks: [
		{
			relation: ["delegate_permission/common.get_login_creds"],
			target: { namespace: "android_app", package_name: "com.example.starter", sha256_cert_fingerprints: ["AA:BB"] },
		},
	],
	appleAppSiteAssociation: { webcredentials: { apps: ["ABCDE12345.com.example.starter"] } },
};

class FakeWebAuthn implements WebAuthnPort {
	public readonly excluded: (readonly PasskeyCredentialRef[])[] = [];
	public readonly allowed: (readonly PasskeyCredentialRef[])[] = [];
	public readonly accounts: PasskeyAccountRef[] = [];
	public newCounter = 0;
	private issued = 0;

	public challengeOf(index: number): string {
		return `challenge${String(index)}`;
	}

	public registrationOptions(account: PasskeyAccountRef, exclude: readonly PasskeyCredentialRef[]): Promise<PasskeyRegistrationOptions> {
		this.accounts.push(account);
		this.excluded.push(exclude);
		return Promise.resolve({
			rp: { id: "example.com", name: "Starter Kit" },
			user: { id: this.userHandleOf(account.userId), name: account.userName, displayName: account.displayName },
			challenge: this.next(),
			pubKeyCredParams: [{ type: "public-key", alg: -7 }],
		});
	}

	public verifyRegistration(response: PasskeyRegistrationResponse, isExpectedChallenge: ChallengeCheck): Promise<CeremonyVerification<VerifiedPasskeyCredential>> {
		if (!isExpectedChallenge(response.response.clientDataJSON)) {
			return Promise.resolve({ verified: false, reason: "challenge mismatch" });
		}
		return Promise.resolve({
			verified: true,
			value: { credentialId: response.id, publicKey: "cHVibGlj", counter: 0, transports: ["internal"], deviceType: "MULTI_DEVICE", backedUp: true, aaguid: "aaguid" },
		});
	}

	public authenticationOptions(allow: readonly PasskeyCredentialRef[]): Promise<PasskeyAuthenticationOptions> {
		this.allowed.push(allow);
		return Promise.resolve({ challenge: this.next(), rpId: "example.com", userVerification: "required" });
	}

	public verifyAuthentication(
		response: PasskeyAuthenticationResponse,
		_key: StoredPasskeyKey,
		isExpectedChallenge: ChallengeCheck,
	): Promise<CeremonyVerification<PasskeyAssertion>> {
		if (!isExpectedChallenge(response.response.clientDataJSON) || response.response.signature !== SIGNATURE_OK) {
			return Promise.resolve({ verified: false, reason: "bad signature" });
		}
		return Promise.resolve({ verified: true, value: { newCounter: this.newCounter, backedUp: true } });
	}

	public userHandleOf(userId: string): string {
		return `handle-${userId}`;
	}

	public appAssociations(): PasskeyAppAssociations {
		return ASSOCIATIONS;
	}

	private next(): string {
		this.issued += 1;
		return this.challengeOf(this.issued);
	}
}

function registration(credentialId: string, signedChallenge: string): PasskeyRegistrationResponse {
	return {
		id: credentialId,
		rawId: credentialId,
		response: { clientDataJSON: signedChallenge, attestationObject: "YXR0" },
		clientExtensionResults: {},
		type: "public-key",
	};
}

function assertion(credentialId: string, signedChallenge: string, overrides: Partial<PasskeyAuthenticationResponse["response"]> = {}): PasskeyAuthenticationResponse {
	return {
		id: credentialId,
		rawId: credentialId,
		response: { clientDataJSON: signedChallenge, authenticatorData: "YXV0aA", signature: SIGNATURE_OK, ...overrides },
		clientExtensionResults: {},
		type: "public-key",
	};
}

let store: InMemoryIdentityStore;
let clock: FixedClock;
let webAuthn: FakeWebAuthn;
const crypto = new FakeCredentialCrypto();

beforeEach(() => {
	store = new InMemoryIdentityStore();
	clock = new FixedClock();
	webAuthn = new FakeWebAuthn();
	store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of(EMAIL), passwordHash: `hash:${PASSWORD}`, fullName: "Jane Doe" }));
});

describe("Adding a passkey", () => {
	let ids: SequentialIds;

	beforeEach(() => {
		ids = new SequentialIds("id");
	});

	function start(password: string = PASSWORD, actor = userActor(USER_ID)): ReturnType<StartPasskeyRegistrationHandler["execute"]> {
		return new StartPasskeyRegistrationHandler(store.uow, webAuthn, crypto, ids, clock).execute(new StartPasskeyRegistrationCommand(actor, { userId: USER_ID, password }));
	}

	function complete(challengeId: string, response: PasskeyRegistrationResponse, actor = userActor(USER_ID)): ReturnType<CompletePasskeyRegistrationHandler["execute"]> {
		return new CompletePasskeyRegistrationHandler(store.uow, webAuthn, crypto, ids, clock).execute(
			new CompletePasskeyRegistrationCommand(actor, { userId: USER_ID, challengeId, name: "  Work laptop  ", response }),
		);
	}

	it("re-checks the password, excludes the account's passkeys, and stores only the challenge's digest", async () => {
		store.passkeys.seed(passkeyState({ id: "existing", userId: USER_ID }));

		const started = await start();

		expect(started).toMatchObject({ challengeId: "id-1", options: { challenge: "challenge1", user: { name: EMAIL, displayName: "Jane Doe" } } });
		expect(webAuthn.excluded).toEqual([[{ credentialId: "cred-existing", transports: ["internal", "hybrid"] }]]);
		expect(store.webAuthnChallenges.rows.get("id-1")).toMatchObject({
			purpose: "REGISTRATION",
			userId: USER_ID,
			challengeHash: "sha:challenge1",
			expiresAt: epochMs(NOW + WEB_AUTHN_CHALLENGE_TTL_MS),
		});
	});

	it("refuses a wrong password, an impersonating administrator, a missing account and a full account", async () => {
		await expect(start("wrong")).rejects.toBeInstanceOf(PasskeyPasswordIncorrectError);
		await expect(start(PASSWORD, userActor(USER_ID, { impersonatorUserId: "admin-1" }))).rejects.toBeInstanceOf(PasskeyChangeDuringImpersonationError);
		store.accounts.rows.delete(USER_ID);
		await expect(start()).rejects.toBeInstanceOf(AccountNotFoundError);
		store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of(EMAIL), passwordHash: `hash:${PASSWORD}` }));
		for (let index = 0; index < MAX_PASSKEYS_PER_ACCOUNT; index += 1) {
			store.passkeys.seed(passkeyState({ id: `p-${String(index)}`, userId: USER_ID }));
		}
		await expect(start()).rejects.toBeInstanceOf(PasskeyLimitReachedError);
		expect(store.webAuthnChallenges.rows.size).toBe(0);
	});

	it("stores the verified credential under the trimmed name, spends the challenge, and emails the owner", async () => {
		const { challengeId } = await start();

		const passkey = await complete(challengeId, registration("new-cred", "challenge1"));

		expect(passkey).toMatchObject({ id: "id-2", name: "Work laptop", deviceType: "MULTI_DEVICE", backedUp: true, lastUsedAt: null });
		expect(store.passkeys.rows.get("id-2")).toMatchObject({ userId: USER_ID, credentialId: "new-cred", publicKey: "cHVibGlj" });
		expect(store.webAuthnChallenges.rows.get(challengeId)?.consumedAt).toBe(NOW);
		expect(store.emails.sent.at(-1)).toEqual({ kind: "passkey_added", to: EMAIL, detail: "Work laptop" });
		await expect(complete(challengeId, registration("other-cred", "challenge1"))).rejects.toBeInstanceOf(PasskeyChallengeInvalidError);
	});

	it("spends the challenge even when the response does not verify, so it is never tried twice", async () => {
		const { challengeId } = await start();

		await expect(complete(challengeId, registration("new-cred", "forged"))).rejects.toBeInstanceOf(PasskeyVerificationFailedError);

		expect(store.webAuthnChallenges.rows.get(challengeId)?.consumedAt).toBe(NOW);
		expect(store.passkeys.rows.size).toBe(0);
		await expect(complete(challengeId, registration("new-cred", "challenge1"))).rejects.toBeInstanceOf(PasskeyChallengeInvalidError);
	});

	it("refuses another account's challenge, an expired one, an impersonator and a credential registered before", async () => {
		store.passkeys.seed(passkeyState({ id: "taken", userId: OTHER_USER_ID, credentialId: "taken-cred" }));
		const { challengeId } = await start();

		await expect(
			new CompletePasskeyRegistrationHandler(store.uow, webAuthn, crypto, ids, clock).execute(
				new CompletePasskeyRegistrationCommand(userActor(OTHER_USER_ID), { userId: OTHER_USER_ID, challengeId, name: "Mine", response: registration("x", "challenge1") }),
			),
		).rejects.toBeInstanceOf(PasskeyChallengeInvalidError);
		await expect(complete(challengeId, registration("x", "challenge1"), userActor(USER_ID, { impersonatorUserId: "admin-1" }))).rejects.toBeInstanceOf(
			PasskeyChangeDuringImpersonationError,
		);
		await expect(complete(challengeId, registration("taken-cred", "challenge1"))).rejects.toBeInstanceOf(PasskeyAlreadyRegisteredError);
		const second = await start();
		clock.advance(WEB_AUTHN_CHALLENGE_TTL_MS + 1);
		await expect(complete(second.challengeId, registration("late", "challenge2"))).rejects.toBeInstanceOf(PasskeyChallengeInvalidError);
	});
});

describe("Managing passkeys", () => {
	beforeEach(() => {
		store.passkeys.seed(passkeyState({ id: "mine", userId: USER_ID, name: "Phone" }));
		store.passkeys.seed(passkeyState({ id: "theirs", userId: OTHER_USER_ID }));
	});

	it("renames the caller's own passkey and answers 404 for anyone else's", async () => {
		const handler = new RenamePasskeyHandler(store.uow, clock);

		await expect(handler.execute(new RenamePasskeyCommand(userActor(USER_ID), { userId: USER_ID, passkeyId: "mine", name: "Pixel" }))).resolves.toMatchObject({
			name: "Pixel",
		});
		await expect(handler.execute(new RenamePasskeyCommand(userActor(USER_ID), { userId: USER_ID, passkeyId: "theirs", name: "Stolen" }))).rejects.toBeInstanceOf(
			PasskeyNotFoundError,
		);
		await expect(
			handler.execute(new RenamePasskeyCommand(userActor(USER_ID, { impersonatorUserId: "admin-1" }), { userId: USER_ID, passkeyId: "mine", name: "x" })),
		).rejects.toBeInstanceOf(PasskeyChangeDuringImpersonationError);
		expect(store.passkeys.rows.get("mine")?.name).toBe("Pixel");
	});

	it("removes (soft-deletes) the caller's passkey, attributed to them, and emails the owner", async () => {
		const handler = new RemovePasskeyHandler(store.uow, clock);

		await expect(handler.execute(new RemovePasskeyCommand(userActor(USER_ID), { userId: USER_ID, passkeyId: "mine" }))).resolves.toEqual({ message: "Passkey removed" });

		expect(store.passkeys.rows.get("mine")).toMatchObject({ isDeleted: true, deletedBy: USER_ID });
		expect(store.emails.sent.at(-1)).toEqual({ kind: "passkey_removed", to: EMAIL, detail: "Phone" });
		await expect(handler.execute(new RemovePasskeyCommand(userActor(USER_ID), { userId: USER_ID, passkeyId: "mine" }))).rejects.toBeInstanceOf(PasskeyNotFoundError);
		await expect(handler.execute(new RemovePasskeyCommand(userActor(USER_ID), { userId: USER_ID, passkeyId: "theirs" }))).rejects.toBeInstanceOf(PasskeyNotFoundError);
	});

	it("lists the caller's passkeys from the read model", async () => {
		const reads = new InMemoryIdentityReads();
		const view: Passkey = { id: "mine", name: "Phone", deviceType: "MULTI_DEVICE", backedUp: true, transports: ["internal"], createdAt: NOW, lastUsedAt: null };
		reads.passkeys.set(USER_ID, [view]);

		await expect(new ListMyPasskeysHandler(reads).execute(new ListMyPasskeysQuery(userActor(USER_ID), { userId: USER_ID }))).resolves.toEqual({ passkeys: [view] });
	});

	it("retires challenges an hour past their expiry", async () => {
		await store.webAuthnChallenges.add(WebAuthnChallenge.forPasswordless({ id: "old", challengeHash: "sha:x" }, NOW));
		clock.advance(WEB_AUTHN_CHALLENGE_TTL_MS + WEB_AUTHN_CHALLENGE_RETENTION_MS);
		await store.webAuthnChallenges.add(WebAuthnChallenge.forPasswordless({ id: "fresh", challengeHash: "sha:y" }, clock.now()));

		await expect(
			new PurgeStaleWebAuthnChallengesHandler(store.uow, clock).execute(new PurgeStaleWebAuthnChallengesCommand(anonymousActor(), { reason: "test" })),
		).resolves.toBe(1);
		expect(store.webAuthnChallenges.rows.get("fresh")?.isDeleted).toBe(false);
	});
});

describe("A passkey as the second factor of a password sign-in", () => {
	let harness: SignInHarness;
	let ids: SequentialIds;

	beforeEach(() => {
		harness = signInHarness(store, clock);
		ids = new SequentialIds("wa");
		store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of(EMAIL), twoFactorEnabled: true }));
		store.twoFactor.enrollments.set(
			USER_ID,
			TwoFactorEnrollment.rehydrate({
				userId: USER_ID,
				enabled: true,
				secret: null,
				lastTotpStep: null,
				pendingSetup: null,
				activeBackupCodes: [],
				tokenVersion: TokenVersion.of(1),
			}),
		);
		store.challenges.rows.set(LOGIN_CHALLENGE_ID, {
			id: LOGIN_CHALLENGE_ID,
			userId: USER_ID,
			purpose: "LOGIN",
			clientType: "web",
			deviceInfo: "Firefox",
			ipAddress: null,
			attemptCount: 0,
			maxAttempts: MFA_CHALLENGE_MAX_ATTEMPTS,
			consumedAt: null,
			expiresAt: epochMs(NOW + MFA_CHALLENGE_TTL_MS),
		});
		harness.tokens.challengeRefs.set(TEMP_TOKEN, {
			userId: USER_ID,
			challengeId: LOGIN_CHALLENGE_ID,
			purpose: "LOGIN",
			clientType: "web",
			deviceInfo: "Firefox",
			ipAddress: null,
		});
	});

	function completion(): MfaLoginCompletion {
		return new MfaLoginCompletion(store.uow, harness.tokens, clock, harness.gate);
	}

	function options(): ReturnType<StartPasskeySecondFactorHandler["execute"]> {
		return new StartPasskeySecondFactorHandler(store.uow, webAuthn, crypto, ids, clock, completion()).execute(
			new StartPasskeySecondFactorCommand(anonymousActor(), { tempToken: TEMP_TOKEN }),
		);
	}

	function verify(challengeId: string, response: PasskeyAuthenticationResponse): ReturnType<CompletePasskeySecondFactorHandler["execute"]> {
		return new CompletePasskeySecondFactorHandler(store.uow, webAuthn, crypto, clock, completion()).execute(
			new CompletePasskeySecondFactorCommand(anonymousActor(), { tempToken: TEMP_TOKEN, challengeId, response, device: DEVICE }),
		);
	}

	it("refuses to ask the browser when the account has no passkey", async () => {
		await expect(options()).rejects.toBeInstanceOf(NoPasskeyRegisteredError);
	});

	it("asks only for the account's own passkeys and issues the session with PASSWORD_PASSKEY", async () => {
		store.passkeys.seed(passkeyState({ id: "mine", userId: USER_ID }));
		const { challengeId } = await options();

		expect(webAuthn.allowed).toEqual([[{ credentialId: "cred-mine", transports: ["internal", "hybrid"] }]]);
		await expect(verify(challengeId, assertion("cred-mine", "challenge1"))).resolves.toMatchObject({ accessToken: `access:${USER_ID}:session-1:full` });

		expect(store.challenges.rows.get(LOGIN_CHALLENGE_ID)?.consumedAt).toBe(NOW);
		expect(store.sessions.rows.get("session-1")).toMatchObject({ signInMethod: "PASSWORD_PASSKEY" });
		expect(store.passkeys.rows.get("mine")?.lastUsedAt).toBe(NOW);
		expect(store.accounts.rows.get(USER_ID)?.mfaAssuredAt).toBe(NOW);
	});

	it("counts a passkey of another account or a bad signature as a wrong second factor", async () => {
		store.passkeys.seed(passkeyState({ id: "mine", userId: USER_ID }));
		store.passkeys.seed(passkeyState({ id: "theirs", userId: OTHER_USER_ID }));

		const first = await options();
		await expect(verify(first.challengeId, assertion("cred-theirs", "challenge1"))).rejects.toBeInstanceOf(PasskeyVerificationFailedError);
		const second = await options();
		await expect(verify(second.challengeId, assertion("cred-mine", "challenge2", { signature: "Zm9yZ2Vk" }))).rejects.toBeInstanceOf(PasskeyVerificationFailedError);

		expect(store.challenges.rows.get(LOGIN_CHALLENGE_ID)?.attemptCount).toBe(2);
		expect(store.sessions.rows.size).toBe(0);
		await expect(verify(second.challengeId, assertion("cred-mine", "challenge2"))).rejects.toBeInstanceOf(PasskeyChallengeInvalidError);
	});

	it("refuses a signature counter that went backwards (a possibly cloned authenticator)", async () => {
		store.passkeys.seed(passkeyState({ id: "key", userId: USER_ID, counter: 10 }));
		webAuthn.newCounter = 10;
		const { challengeId } = await options();

		await expect(verify(challengeId, assertion("cred-key", "challenge1"))).rejects.toBeInstanceOf(PasskeyVerificationFailedError);
		expect(store.passkeys.rows.get("key")?.counter).toBe(10);
	});

	it("burns the login challenge on its last allowed failure (D19)", async () => {
		store.passkeys.seed(passkeyState({ id: "mine", userId: USER_ID }));
		for (let attempt = 1; attempt < MFA_CHALLENGE_MAX_ATTEMPTS; attempt += 1) {
			const { challengeId } = await options();
			await expect(verify(challengeId, assertion("cred-mine", "forged"))).rejects.toBeInstanceOf(PasskeyVerificationFailedError);
		}
		const { challengeId } = await options();

		await expect(verify(challengeId, assertion("cred-mine", "forged"))).rejects.toBeInstanceOf(InvalidCredentialsError);
	});
});

describe("A passwordless passkey sign-in", () => {
	let harness: SignInHarness;
	let flowSubject: RecordingFlowSubject;

	beforeEach(() => {
		harness = signInHarness(store, clock);
		flowSubject = new RecordingFlowSubject();
		store.passkeys.seed(passkeyState({ id: "mine", userId: USER_ID, counter: 3 }));
		webAuthn.newCounter = 4;
	});

	function options(): ReturnType<StartPasswordlessPasskeyLoginHandler["execute"]> {
		return new StartPasswordlessPasskeyLoginHandler(store.uow, webAuthn, crypto, new SequentialIds("wa"), clock).execute(
			new StartPasswordlessPasskeyLoginCommand(anonymousActor(), { clientType: "web" }),
		);
	}

	function signIn(
		challengeId: string,
		response: PasskeyAuthenticationResponse,
		clientType = "web",
		grants = harness.grants,
	): ReturnType<CompletePasswordlessPasskeyLoginHandler["execute"]> {
		return new CompletePasswordlessPasskeyLoginHandler(store.uow, webAuthn, crypto, grants, flowSubject, clock, harness.gate).execute(
			new CompletePasswordlessPasskeyLoginCommand(anonymousActor(), { challengeId, response, clientType, device: DEVICE }),
		);
	}

	it("names no account in the options and stores the challenge without one", async () => {
		const started = await options();

		expect(webAuthn.allowed).toEqual([[]]);
		expect(store.webAuthnChallenges.rows.get(started.challengeId)).toMatchObject({ purpose: "PASSWORDLESS", userId: null, challengeHash: "sha:challenge1" });
	});

	it("signs in with the passkey alone: PASSKEY session, MFA assured, counter moved forward", async () => {
		const { challengeId } = await options();

		await expect(signIn(challengeId, assertion("cred-mine", "challenge1", { userHandle: "handle-user-1" }))).resolves.toMatchObject({
			accessToken: `access:${USER_ID}:session-1:full`,
		});

		expect(store.sessions.rows.get("session-1")).toMatchObject({ signInMethod: "PASSKEY" });
		expect(store.accounts.rows.get(USER_ID)?.mfaAssuredAt).toBe(NOW);
		expect(store.passkeys.rows.get("mine")).toMatchObject({ counter: 4, lastUsedAt: NOW });
		expect(flowSubject.identified).toEqual([USER_ID]);
		await expect(signIn(challengeId, assertion("cred-mine", "challenge1"))).rejects.toBeInstanceOf(PasskeyChallengeInvalidError);
	});

	it("refuses an unknown or removed passkey, a user handle of another account, a bad signature and a locked account alike", async () => {
		store.passkeys.seed(passkeyState({ id: "gone", userId: USER_ID }));
		store.passkeys.rows.set("gone", { ...passkeyState({ id: "gone", userId: USER_ID }), isDeleted: true, deletedBy: USER_ID });
		const attempts: PasskeyAuthenticationResponse[] = [
			assertion("unknown", "challenge1"),
			assertion("cred-gone", "challenge2"),
			assertion("cred-mine", "challenge3", { userHandle: "handle-user-2" }),
			assertion("cred-mine", "challenge4", { signature: "Zm9yZ2Vk" }),
		];
		for (const attempt of attempts) {
			const { challengeId } = await options();
			await expect(signIn(challengeId, attempt)).rejects.toBeInstanceOf(PasskeyVerificationFailedError);
		}
		const account = store.accounts.rows.get(USER_ID);
		if (account !== undefined) {
			store.accounts.rows.set(USER_ID, { ...account, lockout: LockoutState.of(5, epochMs(NOW + MFA_CHALLENGE_TTL_MS)) });
		}
		const { challengeId } = await options();
		await expect(signIn(challengeId, assertion("cred-mine", "challenge5"))).rejects.toBeInstanceOf(PasskeyVerificationFailedError);

		expect(store.sessions.rows.size).toBe(0);
		expect(store.accounts.rows.get(USER_ID)?.lockout.failedAttempts).toBe(5);
	});

	it("applies the admin panel's gate after the passkey verified", async () => {
		const { challengeId } = await options();

		await expect(signIn(challengeId, assertion("cred-mine", "challenge1"), "admin", new FixedGrants())).rejects.toBeInstanceOf(InvalidCredentialsError);
		expect(store.sessions.rows.size).toBe(0);
	});
});

describe("GetPasskeyAppAssociationsHandler", () => {
	it("answers the relying party's native-app associations as the WebAuthn port states them", async () => {
		await expect(new GetPasskeyAppAssociationsHandler(new FakeWebAuthn()).execute()).resolves.toStrictEqual(ASSOCIATIONS);
	});
});
