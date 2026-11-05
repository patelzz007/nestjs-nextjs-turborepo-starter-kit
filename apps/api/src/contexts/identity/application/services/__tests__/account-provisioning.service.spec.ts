import { describe, expect, it } from "vitest";

import { PasswordBreachedError } from "../../../domain/errors/identity.errors";
import { EmailAddress } from "../../../domain/value-objects/email-address.value-object";
import { accountState, FakeBreachCheck, FakeCredentialCrypto, FakeIdentityTokens, InMemoryIdentityStore } from "../../__tests__/fakes/identity.fakes";
import { AccountProvisioningService } from "../account-provisioning.service";

const BREACHED = "Breached-Password-1";

function service(store: InMemoryIdentityStore, breachCheck: FakeBreachCheck): AccountProvisioningService {
	return new AccountProvisioningService(
		store.uow,
		new FakeCredentialCrypto(),
		new FakeIdentityTokens(),
		{ ensureDefaultRole: (): Promise<void> => Promise.resolve() },
		breachCheck,
	);
}

describe("AccountProvisioningService and breached passwords", () => {
	it("refuses a breached password for a new account (invite registration, onboarding)", async () => {
		const provisioning = service(new InMemoryIdentityStore(), new FakeBreachCheck(new Set([BREACHED])));

		await expect(provisioning.hashPassword(BREACHED)).rejects.toBeInstanceOf(PasswordBreachedError);
		await expect(provisioning.checkOnboardingCredentials({ email: "new@example.com", password: BREACHED })).rejects.toBeInstanceOf(PasswordBreachedError);
		await expect(provisioning.hashPassword("Fine-Password-2")).resolves.toBe("hash:Fine-Password-2");
	});

	it("doesn't check the password of an EXISTING account, which only proves it knows its current one", async () => {
		const store = new InMemoryIdentityStore();
		store.accounts.seed(accountState({ id: "user-1", email: EmailAddress.of("old@example.com"), passwordHash: `hash:${BREACHED}` }));
		const breachCheck = new FakeBreachCheck(new Set([BREACHED]));

		await expect(service(store, breachCheck).checkOnboardingCredentials({ email: "old@example.com", password: BREACHED })).resolves.toEqual({
			kind: "existing",
			userId: "user-1",
		});
		expect(breachCheck.checked).toEqual([]);
	});
});
