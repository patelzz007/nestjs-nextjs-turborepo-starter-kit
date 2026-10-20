import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { FilesController } from "../files.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(FilesController.prototype, name);
}

describe("file processing callback", () => {
	const reflector = new Reflector();

	it("applies a scan verdict under files.scan_verdict.apply", () => {
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("processingCallback"))).toBe("files.scan_verdict.apply");
	});
});
