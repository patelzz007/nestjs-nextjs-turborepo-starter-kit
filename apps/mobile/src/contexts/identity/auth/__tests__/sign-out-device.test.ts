import { SIGN_OUT_REVOKE_TIMEOUT_MS, signOutDevice, type SignOutDeviceSteps } from "../sign-out-device";

/** Steps whose revoke answers with `revoke`, recording the abort signal it was given and whether the device left. */
function steps(revoke: (signal: AbortSignal) => Promise<boolean>): SignOutDeviceSteps & { readonly left: () => boolean; readonly signal: () => AbortSignal | undefined } {
	let hasLeft = false;
	let given: AbortSignal | undefined;
	return {
		revoke: (signal: AbortSignal): Promise<boolean> => {
			given = signal;
			return revoke(signal);
		},
		leave: (): Promise<void> => {
			hasLeft = true;
			return Promise.resolve();
		},
		left: (): boolean => hasLeft,
		signal: (): AbortSignal | undefined => given,
	};
}

describe("signOutDevice", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("leaves after the API confirms the revoke", async () => {
		const device = steps((): Promise<boolean> => Promise.resolve(true));

		await expect(signOutDevice(device)).resolves.toBe("revoked");
		expect(device.left()).toBe(true);
	});

	it("leaves when the API refuses the revoke", async () => {
		const device = steps((): Promise<boolean> => Promise.resolve(false));

		await expect(signOutDevice(device)).resolves.toBe("unconfirmed");
		expect(device.left()).toBe(true);
	});

	it("leaves when the API cannot be reached", async () => {
		const device = steps((): Promise<boolean> => Promise.reject(new TypeError("Network request failed")));

		await expect(signOutDevice(device)).resolves.toBe("unconfirmed");
		expect(device.left()).toBe(true);
	});

	it("leaves at the deadline when the API never answers, and aborts the request", async () => {
		jest.useFakeTimers();
		const device = steps((): Promise<boolean> => new Promise<boolean>(() => undefined));

		const signingOut = signOutDevice(device);
		expect(device.left()).toBe(false);
		await jest.advanceTimersByTimeAsync(SIGN_OUT_REVOKE_TIMEOUT_MS);

		await expect(signingOut).resolves.toBe("unconfirmed");
		expect(device.left()).toBe(true);
		expect(device.signal()?.aborted).toBe(true);
	});
});
