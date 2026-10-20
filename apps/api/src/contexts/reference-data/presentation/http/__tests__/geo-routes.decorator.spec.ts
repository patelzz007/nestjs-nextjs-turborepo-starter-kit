import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { GeoController } from "../geo.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(GeoController.prototype, name);
}

describe("geo routes", () => {
	const reflector = new Reflector();

	it("reads under geo.reference_data.read and writes under geo.reference_data.write", () => {
		for (const name of ["getStats", "autocomplete", "validateImport", "exportData", "listRegions", "getCity"]) {
			expect(reflector.getAllAndOverride(PLATFORM_OPERATION_KEY, [handler(name), GeoController])).toBe("geo.reference_data.read");
		}
		for (const name of ["importData", "createRegion", "updateCountry", "deleteCity"]) {
			expect(reflector.getAllAndOverride(PLATFORM_OPERATION_KEY, [handler(name), GeoController])).toBe("geo.reference_data.write");
		}
	});
});
