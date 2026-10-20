import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { LocalStorageTransferController } from "../local-storage-transfer.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(LocalStorageTransferController.prototype, name);
}

describe("local storage transfer routes", () => {
	const reflector = new Reflector();

	it("reads a stored file for a signed object, a public asset, or an upload ticket", () => {
		for (const name of ["localDownload", "localPublic", "localUpload"]) {
			expect(reflector.get(PUBLIC_OPERATION_KEY, handler(name))).toBe("files.local_object.read");
		}
	});

	it("reads a public rendition under files.local_variant.read", () => {
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("localPublicVariant"))).toBe("files.local_variant.read");
	});
});
