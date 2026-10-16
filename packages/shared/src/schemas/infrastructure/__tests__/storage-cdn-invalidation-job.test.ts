import { describe, expect, it } from "vitest";

import { QUEUE_NAMES, StorageCdnInvalidationJobSchema } from "./queue";

const FILE_ID = "11111111-1111-4111-8111-111111111111";

describe("StorageCdnInvalidationJobSchema", () => {
	it("accepts a file id with at least one object key", () => {
		expect(StorageCdnInvalidationJobSchema.parse({ fileId: FILE_ID, objectKeys: ["products/a/original/b.png"] }).objectKeys).toEqual(["products/a/original/b.png"]);
	});

	it("rejects an empty key list, an empty key and unknown fields", () => {
		expect(StorageCdnInvalidationJobSchema.safeParse({ fileId: FILE_ID, objectKeys: [] }).success).toBe(false);
		expect(StorageCdnInvalidationJobSchema.safeParse({ fileId: FILE_ID, objectKeys: [""] }).success).toBe(false);
		expect(StorageCdnInvalidationJobSchema.safeParse({ fileId: FILE_ID, objectKeys: ["k"], distributionId: "E1" }).success).toBe(false);
	});

	it("has its own queue", () => {
		expect(QUEUE_NAMES.storageCdnInvalidate).toBe("storage.cdn-invalidate");
	});
});
