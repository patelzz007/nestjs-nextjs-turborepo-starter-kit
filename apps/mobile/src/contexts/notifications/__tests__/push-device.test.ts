import type { RegisterPushDeviceInput } from "@workspace/shared";

import { pushPlatformOf, pushTapOf, refreshThisPhone, registerThisPhone, type PushDevicePorts, type PushPermission } from "../push-device";

/** A Firebase Installation ID as Firebase generates it. */
const FID = "fH3kVq9TzR1aB2cD3eF4g_";

function ports(overrides: Partial<PushDevicePorts> = {}): PushDevicePorts & { readonly registered: RegisterPushDeviceInput[] } {
	const registered: RegisterPushDeviceInput[] = [];
	return {
		os: "android",
		permission: (): Promise<PushPermission> => Promise.resolve("undetermined"),
		requestPermission: (): Promise<PushPermission> => Promise.resolve("granted"),
		nativeToken: (): Promise<string> => Promise.resolve("fcm-token"),
		installationId: (): Promise<string | null> => Promise.resolve(FID),
		register: (input: RegisterPushDeviceInput): Promise<void> => {
			registered.push(input);
			return Promise.resolve();
		},
		deviceLabel: "Pixel 9",
		appVersion: "1.2.0",
		...overrides,
		registered,
	};
}

describe("registerThisPhone", () => {
	it("asks once, then registers the native token as this phone", async () => {
		const phone = ports();

		await expect(registerThisPhone(phone)).resolves.toEqual({ kind: "registered" });
		expect(phone.registered).toEqual([{ token: "fcm-token", platform: "ANDROID", surface: "CUSTOMER", deviceLabel: "Pixel 9", appVersion: "1.2.0", installationId: FID }]);
	});

	it("reports the installation ID FCM sends by on Android only, and none where the build can't tell it (enhancement 5.3)", async () => {
		const iphone = ports({ os: "ios" });
		await registerThisPhone(iphone);
		expect(iphone.registered).toMatchObject([{ platform: "IOS", installationId: null }]);

		const olderBuild = ports({ installationId: (): Promise<string | null> => Promise.resolve(null) });
		await registerThisPhone(olderBuild);
		expect(olderBuild.registered).toMatchObject([{ platform: "ANDROID", installationId: null }]);
	});

	it("does not ask again once the person decided", async () => {
		const requestPermission = jest.fn((): Promise<PushPermission> => Promise.resolve("granted"));
		await registerThisPhone(ports({ permission: (): Promise<PushPermission> => Promise.resolve("granted"), requestPermission }));

		expect(requestPermission).not.toHaveBeenCalled();
	});

	it("registers nothing when the permission is refused", async () => {
		const phone = ports({ requestPermission: (): Promise<PushPermission> => Promise.resolve("denied") });

		await expect(registerThisPhone(phone)).resolves.toEqual({ kind: "denied" });
		expect(phone.registered).toEqual([]);
	});

	it("is unavailable without a token, and never throws", async () => {
		await expect(registerThisPhone(ports({ nativeToken: (): Promise<string> => Promise.reject(new Error("no FCM")) }))).resolves.toEqual({ kind: "unavailable" });
		await expect(registerThisPhone(ports({ os: "web" }))).resolves.toEqual({ kind: "unavailable" });
	});
});

describe("pushPlatformOf", () => {
	it("maps the OS to the API's platform", () => {
		expect(pushPlatformOf("ios")).toBe("IOS");
		expect(pushPlatformOf("android")).toBe("ANDROID");
		expect(pushPlatformOf("web")).toBeNull();
	});
});

describe("pushTapOf", () => {
	it("reads the delivery and the link of a tapped push", () => {
		expect(pushTapOf({ deliveryId: "0193f2c4-0000-7000-8000-0000000000a1", link: "/dashboard" })).toEqual({
			deliveryId: "0193f2c4-0000-7000-8000-0000000000a1",
			link: "/dashboard",
		});
		expect(pushTapOf({ deliveryId: "0193f2c4-0000-7000-8000-0000000000a1" })?.link).toBeNull();
	});

	it("ignores a push that is not ours", () => {
		expect(pushTapOf({ foo: "bar" })).toBeNull();
		expect(pushTapOf(null)).toBeNull();
	});
});

describe("refreshThisPhone", () => {
	it("registers an already-allowed phone again, without asking", async () => {
		const asked = jest.fn<Promise<PushPermission>, []>(() => Promise.resolve("granted"));
		const phone = ports({ permission: (): Promise<PushPermission> => Promise.resolve("granted"), requestPermission: asked });

		expect(await refreshThisPhone(phone)).toEqual({ kind: "registered" });
		expect(asked).not.toHaveBeenCalled();
		expect(phone.registered).toEqual([{ token: "fcm-token", platform: "ANDROID", surface: "CUSTOMER", deviceLabel: "Pixel 9", appVersion: "1.2.0", installationId: FID }]);
	});

	it("reports the installation ID FCM sends by on Android only, and none where the build can't tell it (enhancement 5.3)", async () => {
		const iphone = ports({ os: "ios" });
		await registerThisPhone(iphone);
		expect(iphone.registered).toMatchObject([{ platform: "IOS", installationId: null }]);

		const olderBuild = ports({ installationId: (): Promise<string | null> => Promise.resolve(null) });
		await registerThisPhone(olderBuild);
		expect(olderBuild.registered).toMatchObject([{ platform: "ANDROID", installationId: null }]);
	});

	it("leaves an undecided or refused phone alone: only the primer's button asks", async () => {
		for (const permission of ["undetermined", "denied"] satisfies PushPermission[]) {
			const asked = jest.fn<Promise<PushPermission>, []>(() => Promise.resolve("granted"));
			const phone = ports({ permission: (): Promise<PushPermission> => Promise.resolve(permission), requestPermission: asked });

			expect(await refreshThisPhone(phone)).toEqual({ kind: "skipped" });
			expect(asked).not.toHaveBeenCalled();
			expect(phone.registered).toEqual([]);
		}
	});

	it("says unavailable without a push platform, a token or the API, and never throws", async () => {
		expect(await refreshThisPhone(ports({ os: "web" }))).toEqual({ kind: "unavailable" });
		const noToken = ports({ permission: (): Promise<PushPermission> => Promise.resolve("granted"), nativeToken: (): Promise<string> => Promise.reject(new Error("no FCM")) });
		expect(await refreshThisPhone(noToken)).toEqual({ kind: "unavailable" });
		const apiDown = ports({ permission: (): Promise<PushPermission> => Promise.resolve("granted"), register: (): Promise<void> => Promise.reject(new Error("503")) });
		expect(await refreshThisPhone(apiDown)).toEqual({ kind: "unavailable" });
	});
});
