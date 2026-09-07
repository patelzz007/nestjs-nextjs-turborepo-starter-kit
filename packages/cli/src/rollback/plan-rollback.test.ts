import { describe, expect, it } from "vitest";

import { RollbackPlanSchema } from "./rollback-schema";

describe("RollbackPlanSchema", () => {
	it("accepts a valid rollback plan", () => {
		const parsed = RollbackPlanSchema.safeParse({
			resource: "product",
			steps: [
				{
					action: "unpatch",
					path: ".",
					reason: "Remove generator blocks from shared patched files",
				},
				{
					action: "delete",
					path: "apps/admin/app/(panel)/product/page.tsx",
					reason: "Remove generator-created resource file",
				},
			],
			warnings: ["Database migrations are not reverted."],
			canRollback: true,
		});

		expect(parsed.success).toBe(true);
	});
});
