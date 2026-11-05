import { firebaseInstallationId, type InstallationIdLoader } from "../firebase-installation-id";

/** A Firebase Installation ID as Firebase generates it. */
const FID = "fH3kVq9TzR1aB2cD3eF4g_";

function loader(hasNativeModule: boolean, readId: () => Promise<string>): InstallationIdLoader {
	return { hasNativeModule: (): boolean => hasNativeModule, readId };
}

describe("firebaseInstallationId (enhancement 5.3)", () => {
	it("reads this install's ID where the build has the installations module", async () => {
		await expect(firebaseInstallationId(loader(true, (): Promise<string> => Promise.resolve(FID)))).resolves.toBe(FID);
	});

	it("is unknown in a build without the module, never loading the SDK", async () => {
		const readId = jest.fn((): Promise<string> => Promise.resolve(FID));
		await expect(firebaseInstallationId(loader(false, readId))).resolves.toBeNull();
		expect(readId).not.toHaveBeenCalled();
	});

	it("is unknown when Firebase fails or answers something that isn't an ID", async () => {
		await expect(firebaseInstallationId(loader(true, (): Promise<string> => Promise.reject(new Error("no network"))))).resolves.toBeNull();
		await expect(firebaseInstallationId(loader(true, (): Promise<string> => Promise.resolve("garbage")))).resolves.toBeNull();
	});
});
