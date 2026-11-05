/**
 * Whether a new password appears in a known data breach (enhancement 1.6). `clear` and `breached` are
 * answers; `unavailable` means the check couldn't be made (the service was unreachable) and `skipped` that
 * it is switched off (`PASSWORD_BREACH_CHECK=off`). Only `breached` refuses the password: the check fails
 * open, so an outage of the breach service never locks people out of signing up or resetting.
 */
export type BreachedPasswordVerdict = "breached" | "clear" | "unavailable" | "skipped";

export interface BreachedPasswordCheckPort {
	check(password: string): Promise<BreachedPasswordVerdict>;
}
