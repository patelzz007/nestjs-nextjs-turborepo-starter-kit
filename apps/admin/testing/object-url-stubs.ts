import { afterEach, beforeEach } from "vitest";

// `useFileUpload` previews every picked file through `URL.createObjectURL` and
// revokes it on removal; jsdom implements neither, so these install inert
// stand-ins for the duration of each test. Call once per test file.

const PREVIEW_URL = "blob:test-preview";
const OBJECT_URL_METHODS: readonly ["createObjectURL", "revokeObjectURL"] = ["createObjectURL", "revokeObjectURL"];

function createPreviewUrl(): string {
	return PREVIEW_URL;
}

function revokePreviewUrl(): void {
	return;
}

export function installObjectUrlStubs(): void {
	beforeEach((): void => {
		Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: createPreviewUrl });
		Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revokePreviewUrl });
	});

	afterEach((): void => {
		for (const name of OBJECT_URL_METHODS) {
			Reflect.deleteProperty(URL, name);
		}
	});
}

/** A picked image of `sizeBytes` bytes. */
export function imageFile(name: string, sizeBytes = 1): File {
	return new File([new Uint8Array(sizeBytes)], name, { type: "image/png" });
}
