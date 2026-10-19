import { describe, expect, it } from "vitest";

import { LOCAL_DOWNLOAD_TOKEN_PARAM } from "../../../../../platform/infrastructure/storage/adapters/local/local-object-storage.adapter";
import { PUBLIC_ASSET_CACHE_CONTROL } from "../../../../../platform/infrastructure/storage/domain/public-delivery.port";
import { LOCAL_DOWNLOAD_TOKEN_QUERY_PARAM, LOCAL_PUBLIC_ASSET_CACHE_CONTROL } from "../../../application/ports/local-storage-transfer.port";

describe("local storage transfer constants", () => {
	it("are the local adapter's and the public-delivery port's own values (presentation may not import them)", () => {
		expect(LOCAL_DOWNLOAD_TOKEN_QUERY_PARAM).toBe(LOCAL_DOWNLOAD_TOKEN_PARAM);
		expect(LOCAL_PUBLIC_ASSET_CACHE_CONTROL).toBe(PUBLIC_ASSET_CACHE_CONTROL);
	});
});
