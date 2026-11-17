import { FlagDeviceId, loadFlagDeviceId, type FlagDeviceIdStorage } from "../flag-device-id";

const STORED = "019b76da-a800-7000-8000-000000000030";
const FRESH = "019b76da-a800-7000-8000-000000000031";

function storage(stored: string | null, failing = false): FlagDeviceIdStorage & { readonly written: string[] } {
	const written: string[] = [];
	return {
		written,
		read: (): Promise<string | null> => (failing ? Promise.reject(new Error("keychain locked")) : Promise.resolve(stored)),
		write: (id: string): Promise<void> => {
			written.push(id);
			return Promise.resolve();
		},
		newId: (): string => FRESH,
	};
}

describe("loadFlagDeviceId", () => {
	it("keeps the id this installation already has", async () => {
		const kept = storage(STORED);
		await expect(loadFlagDeviceId(kept)).resolves.toBe(STORED);
		expect(kept.written).toEqual([]);
	});

	it("makes and saves one on the first start", async () => {
		const first = storage(null);
		await expect(loadFlagDeviceId(first)).resolves.toBe(FRESH);
		expect(first.written).toEqual([FRESH]);
	});

	it("gives none when Secure Store can't be used", async () => {
		await expect(loadFlagDeviceId(storage(null, true))).resolves.toBeNull();
	});
});

describe("FlagDeviceId", () => {
	it("sends no header until loaded, then the id", () => {
		const deviceId = new FlagDeviceId();
		expect(deviceId.headers()).toEqual({});
		deviceId.use(STORED);
		expect(deviceId.current).toBe(STORED);
		expect(deviceId.headers()).toEqual({ "X-Device-Id": STORED });
	});

	it("ignores anything that isn't a device id", () => {
		const deviceId = new FlagDeviceId();
		deviceId.use("not-a-uuid");
		expect(deviceId.headers()).toEqual({});
	});
});
