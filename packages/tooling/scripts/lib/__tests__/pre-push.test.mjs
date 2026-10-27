import { describe, expect, it } from "vitest";

import { selectSteps, staticSteps } from "../ci-local-plan.mjs";
import { PRE_PUSH_STEP_IDS, pushesNothingNew } from "../pre-push.mjs";

const OID = "8f3c2a1b9d0e4f5a6b7c8d9e0f1a2b3c4d5e6f70";
const ZERO = "0000000000000000000000000000000000000000";

describe("PRE_PUSH_STEP_IDS", () => {
	it("are ci:local's lint, typecheck and unit-test steps, so a push runs exactly what CI runs", () => {
		const steps = selectSteps(staticSteps({ base: "origin/main", noCache: false }), PRE_PUSH_STEP_IDS);

		expect(steps.map((step) => step.id)).toStrictEqual(["lint", "typecheck", "test"]);
		expect(steps.map((step) => step.args.join(" "))).toStrictEqual(["turbo run lint", "turbo run typecheck", "turbo run test --concurrency=1"]);
	});
});

describe("pushesNothingNew", () => {
	it("is true when every pushed ref is a deletion, or nothing is pushed", () => {
		expect(pushesNothingNew(`(delete) ${ZERO} refs/heads/old ${OID}\n`)).toBe(true);
		expect(pushesNothingNew("")).toBe(true);
	});

	it("is false as soon as one ref carries commits", () => {
		expect(pushesNothingNew(`refs/heads/main ${OID} refs/heads/main ${ZERO}\n`)).toBe(false);
		expect(pushesNothingNew(`(delete) ${ZERO} refs/heads/old ${OID}\nrefs/heads/feat ${OID} refs/heads/feat ${OID}\n`)).toBe(false);
	});
});
