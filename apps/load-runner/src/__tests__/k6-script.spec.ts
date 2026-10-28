import { describe, expect, it } from "vitest";

import { k6Script } from "../k6-script";

describe("k6Script", () => {
	it("reads its plan from LOAD_TEST_CONFIG and tags requests with their step and traffic key", () => {
		const script: string = k6Script();

		expect(script).toContain("__ENV.LOAD_TEST_CONFIG");
		expect(script).toContain("X-Load-Test-Key");
		expect(script).toContain("step");
		expect(script).toContain("export default function");
	});
});
