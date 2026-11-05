import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";
import { Passkey, type PasskeyState, type VerifiedPasskeyCredential } from "../aggregates/passkey.aggregate";
import { WEB_AUTHN_CHALLENGE_TTL_MS, WebAuthnChallenge, type WebAuthnChallengeState } from "../aggregates/web-authn-challenge.aggregate";
import { PasskeyChallengeInvalidError, PasskeyNameInvalidError, PasskeyVerificationFailedError } from "../errors/identity.errors";

const NOW = epochMs(1_786_000_000_000);
const LATER = epochMs(NOW + 1000);

const CREDENTIAL: VerifiedPasskeyCredential = {
	credentialId: "Y3JlZC0x",
	publicKey: "cHVibGljLWtleQ",
	counter: 0,
	transports: ["internal", "hybrid"],
	deviceType: "MULTI_DEVICE",
	backedUp: true,
	aaguid: "00000000-0000-0000-0000-000000000000",
};

function state(overrides: Partial<PasskeyState> = {}): PasskeyState {
	return { ...CREDENTIAL, id: "passkey-1", userId: "user-1", name: "Pixel 9", createdAt: NOW, lastUsedAt: null, ...overrides };
}

describe("Passkey", () => {
	it("registers a verified credential under a valid name, unused", () => {
		const passkey = Passkey.register({ id: "passkey-1", userId: "user-1", name: "Pixel 9", credential: CREDENTIAL }, NOW);

		expect(passkey.snapshot).toStrictEqual(state());
		expect(passkey.isOwnedBy("user-1")).toBe(true);
		expect(passkey.isOwnedBy("user-2")).toBe(false);
	});

	it("refuses a name the contract does not allow", () => {
		expect(() => Passkey.register({ id: "passkey-1", userId: "user-1", name: "", credential: CREDENTIAL }, NOW)).toThrow(PasskeyNameInvalidError);
		expect(() => {
			Passkey.rehydrate(state()).rename("x".repeat(65), NOW);
		}).toThrow(PasskeyNameInvalidError);
	});

	it("refuses to load a stored row whose credential is unusable", () => {
		expect(() => Passkey.rehydrate(state({ counter: -1 }))).toThrow(CorruptAggregateStateError);
		expect(() => Passkey.rehydrate(state({ credentialId: "" }))).toThrow(CorruptAggregateStateError);
		expect(() => Passkey.rehydrate(state({ publicKey: "" }))).toThrow(CorruptAggregateStateError);
	});

	it("records a use: the new counter, the backed-up state and when, as a compare-and-set on the counter it read", () => {
		const passkey = Passkey.rehydrate(state({ counter: 4 }));

		passkey.recordUse({ newCounter: 5, backedUp: false }, LATER);

		expect(passkey.snapshot).toMatchObject({ counter: 5, backedUp: false, lastUsedAt: LATER });
		expect(passkey.pendingChanges).toStrictEqual([{ kind: "used", previousCounter: 4, counter: 5, backedUp: false, at: LATER }]);
	});

	it("refuses a counter that did not move forward (a possibly cloned authenticator), and changes nothing", () => {
		const passkey = Passkey.rehydrate(state({ counter: 5 }));

		expect(passkey.acceptsCounter(5)).toBe(false);
		expect(passkey.acceptsCounter(4)).toBe(false);
		expect(() => {
			passkey.recordUse({ newCounter: 5, backedUp: true }, LATER);
		}).toThrow(PasskeyVerificationFailedError);
		expect(passkey.snapshot.counter).toBe(5);
		expect(passkey.pendingChanges).toStrictEqual([]);
	});

	it("accepts a synced passkey that never counts (0 every time)", () => {
		const passkey = Passkey.rehydrate(state({ counter: 0 }));

		expect(passkey.acceptsCounter(0)).toBe(true);
		passkey.recordUse({ newCounter: 0, backedUp: true }, LATER);
		expect(passkey.snapshot.counter).toBe(0);
	});

	it("records a rename and a removal for the repository to apply", () => {
		const passkey = Passkey.rehydrate(state());

		passkey.rename("Work phone", LATER);
		passkey.remove("user-1", LATER);

		expect(passkey.name).toBe("Work phone");
		expect(passkey.pendingChanges).toStrictEqual([
			{ kind: "renamed", name: "Work phone", at: LATER },
			{ kind: "removed", by: "user-1", at: LATER },
		]);
	});
});

describe("WebAuthnChallenge", () => {
	const registration = (): WebAuthnChallenge => WebAuthnChallenge.forRegistration({ id: "challenge-1", userId: "user-1", challengeHash: "digest" }, NOW);

	it("expires a fixed time after it is issued", () => {
		expect(registration().snapshot).toStrictEqual({
			id: "challenge-1",
			userId: "user-1",
			purpose: "REGISTRATION",
			challengeHash: "digest",
			loginChallengeId: null,
			expiresAt: epochMs(NOW + WEB_AUTHN_CHALLENGE_TTL_MS),
			consumedAt: null,
		});
	});

	it("matches only the digest it was issued with", () => {
		expect(registration().matches("digest")).toBe(true);
		expect(registration().matches("other")).toBe(false);
	});

	it("is consumed once, by the ceremony and account it was issued for", () => {
		const challenge = registration();

		challenge.consumeFor({ purpose: "REGISTRATION", userId: "user-1" }, LATER);

		expect(challenge.wasConsumed).toBe(true);
		expect(challenge.snapshot.consumedAt).toBe(LATER);
		expect(() => {
			challenge.consumeFor({ purpose: "REGISTRATION", userId: "user-1" }, LATER);
		}).toThrow(PasskeyChallengeInvalidError);
	});

	it("refuses another account, another ceremony, or an expired challenge", () => {
		expect(() => {
			registration().consumeFor({ purpose: "REGISTRATION", userId: "user-2" }, LATER);
		}).toThrow(PasskeyChallengeInvalidError);
		expect(() => {
			registration().consumeFor({ purpose: "PASSWORDLESS" }, LATER);
		}).toThrow(PasskeyChallengeInvalidError);
		expect(() => {
			registration().consumeFor({ purpose: "REGISTRATION", userId: "user-1" }, epochMs(NOW + WEB_AUTHN_CHALLENGE_TTL_MS + 1));
		}).toThrow(PasskeyChallengeInvalidError);
	});

	it("ties a second-factor challenge to the password sign-in it finishes", () => {
		const challenge = WebAuthnChallenge.forSecondFactor({ id: "challenge-2", userId: "user-1", loginChallengeId: "login-1", challengeHash: "digest" }, NOW);

		expect(() => {
			challenge.consumeFor({ purpose: "SECOND_FACTOR", userId: "user-1", loginChallengeId: "login-2" }, LATER);
		}).toThrow(PasskeyChallengeInvalidError);
		challenge.consumeFor({ purpose: "SECOND_FACTOR", userId: "user-1", loginChallengeId: "login-1" }, LATER);
		expect(challenge.wasConsumed).toBe(true);
	});

	it("names no account for a passwordless sign-in", () => {
		const challenge = WebAuthnChallenge.forPasswordless({ id: "challenge-3", challengeHash: "digest" }, NOW);

		expect(challenge.snapshot.userId).toBeNull();
		challenge.consumeFor({ purpose: "PASSWORDLESS" }, LATER);
		expect(challenge.wasConsumed).toBe(true);
	});

	it("refuses to load a stored row whose account or login reference does not fit its purpose", () => {
		const stored: WebAuthnChallengeState = registration().snapshot;

		expect(() => WebAuthnChallenge.rehydrate({ ...stored, userId: null })).toThrow(CorruptAggregateStateError);
		expect(() => WebAuthnChallenge.rehydrate({ ...stored, purpose: "SECOND_FACTOR" })).toThrow(CorruptAggregateStateError);
		expect(() => WebAuthnChallenge.rehydrate({ ...stored, purpose: "PASSWORDLESS" })).toThrow(CorruptAggregateStateError);
		expect(() => WebAuthnChallenge.rehydrate({ ...stored, challengeHash: "" })).toThrow(CorruptAggregateStateError);
		expect(WebAuthnChallenge.rehydrate(stored).snapshot).toStrictEqual(stored);
	});
});
