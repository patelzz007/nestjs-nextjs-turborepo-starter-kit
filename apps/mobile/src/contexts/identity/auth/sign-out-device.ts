// Signing this device out: ask the API to revoke the session, then leave —
// always, and within a bounded time. The revoke is a courtesy to the server
// (the session would otherwise end at its expiry, or from the device list on
// another client); leaving is the user's request and must never wait on a
// network that does not answer (API down, no signal), or the sign-out spinner
// would turn forever.

/** How long sign-out waits for the API to revoke this device's session before the device leaves anyway. */
export const SIGN_OUT_REVOKE_TIMEOUT_MS = 5_000;

/** Whether the API confirmed the revoke; `unconfirmed` covers a refusal, a network failure and a timeout. */
export type SignOutRevocation = "revoked" | "unconfirmed";

export interface SignOutDeviceSteps {
	/** Revokes this device's session; resolves `true` when the API confirmed it. Aborted at the deadline. */
	readonly revoke: (signal: AbortSignal) => Promise<boolean>;
	/** Clears this device's tokens and ends the in-app session. */
	readonly leave: () => Promise<void>;
}

export async function signOutDevice(steps: SignOutDeviceSteps, timeoutMs: number = SIGN_OUT_REVOKE_TIMEOUT_MS): Promise<SignOutRevocation> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timedOut = new Promise<SignOutRevocation>((resolve) => {
		timer = setTimeout((): void => {
			controller.abort();
			resolve("unconfirmed");
		}, timeoutMs);
	});
	const revoked = steps.revoke(controller.signal).then(
		(confirmed: boolean): SignOutRevocation => (confirmed ? "revoked" : "unconfirmed"),
		(): SignOutRevocation => "unconfirmed",
	);
	try {
		return await Promise.race([revoked, timedOut]);
	} finally {
		clearTimeout(timer);
		await steps.leave();
	}
}
