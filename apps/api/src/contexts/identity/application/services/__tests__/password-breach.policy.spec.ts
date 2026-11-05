import { describe, expect, it } from "vitest";

import { PasswordBreachedError } from "../../../domain/errors/identity.errors";
import type { BreachedPasswordCheckPort, BreachedPasswordVerdict } from "../../ports/breached-password.port";
import { assertPasswordNotBreached } from "../password-breach.policy";

function answering(verdict: BreachedPasswordVerdict): BreachedPasswordCheckPort {
	return { check: (): Promise<BreachedPasswordVerdict> => Promise.resolve(verdict) };
}

describe("assertPasswordNotBreached", () => {
	it("refuses only a breached password", async () => {
		await expect(assertPasswordNotBreached(answering("breached"), "x")).rejects.toBeInstanceOf(PasswordBreachedError);
	});

	it.each<BreachedPasswordVerdict>(["clear", "unavailable", "skipped"])("lets a %s verdict through (the check fails open)", async (verdict) => {
		await expect(assertPasswordNotBreached(answering(verdict), "x")).resolves.toBeUndefined();
	});
});
