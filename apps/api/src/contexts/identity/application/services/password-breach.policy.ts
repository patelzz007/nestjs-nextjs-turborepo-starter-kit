import { PasswordBreachedError } from "../../domain/errors/identity.errors";
import type { BreachedPasswordCheckPort, BreachedPasswordVerdict } from "../ports/breached-password.port";

/**
 * Refuses a new password found in a known data breach (sign-up, reset, change, invite and onboarding
 * registration, SuperAdmin bootstrap). Anything but a `breached` verdict lets it through.
 */
export async function assertPasswordNotBreached(check: BreachedPasswordCheckPort, password: string): Promise<void> {
	const verdict: BreachedPasswordVerdict = await check.check(password);
	if (verdict === "breached") {
		throw new PasswordBreachedError();
	}
}
