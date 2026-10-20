import { BadRequestException } from "@nestjs/common";
import { apiContract } from "@workspace/shared";
import { z, ZodType } from "zod";
import { describe, expect, it } from "vitest";

import { ZodValidationPipe } from "../zod-validation.pipe";

const TENANT_ID = "019b76da-a800-7a94-a198-23ad1b4cfdd9";

const ContractLeafSchema = z
	.object({
		method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
		path: z.string(),
		input: z.custom<ZodType>((value): boolean => value instanceof ZodType),
	})
	.loose();

interface ContractLeaf {
	readonly path: string;
	readonly input: ZodType;
}

/** Tenant routes, customer marketplace/claims, and every machine route (`/integration/*`). */
function isTenantMachineOrCustomerPath(path: string): boolean {
	return (
		path.includes("/tenants/:tenantSlug") ||
		path.startsWith("/rewards") ||
		path.startsWith("/claims") ||
		path.startsWith("/reward-notifications") ||
		path.startsWith("/integration/")
	);
}

/** A branch of the contract tree, kept as the same object (an object schema would copy it). */
const ContractNodeSchema = z.custom<object>((value): boolean => z.looseObject({}).safeParse(value).success);

function collectLeaves(node: object, leaves: ContractLeaf[]): void {
	for (const value of Object.values(node)) {
		const leaf = ContractLeafSchema.safeParse(value);
		if (leaf.success) {
			leaves.push({ path: leaf.data.path, input: leaf.data.input });
			continue;
		}
		const branch = ContractNodeSchema.safeParse(value);
		if (branch.success) {
			collectLeaves(branch.data, leaves);
		}
	}
}

function declaresTenantId(schema: ZodType): boolean {
	return schema instanceof z.ZodObject && Object.hasOwn(schema.shape, "tenantId");
}

describe("tenant, machine and customer request schemas", () => {
	const leaves: ContractLeaf[] = [];
	collectLeaves(apiContract, leaves);
	const scoped = leaves.filter((leaf) => isTenantMachineOrCustomerPath(leaf.path) && !leaf.input.safeParse(undefined).success);

	it("finds the scoped routes", () => {
		expect(scoped.length).toBeGreaterThan(0);
	});

	it("MT-007: rejects a client-sent tenantId with 400 and does not declare tenantId", () => {
		const failures: string[] = [];
		for (const leaf of scoped) {
			if (declaresTenantId(leaf.input)) {
				failures.push(`${leaf.path} declares tenantId`);
				continue;
			}
			const parsed = leaf.input.safeParse({ tenantId: TENANT_ID });
			const unrecognized = !parsed.success && parsed.error.issues.some((issue) => issue.code === "unrecognized_keys" && issue.keys.includes("tenantId"));
			let pipeRejected = false;
			try {
				new ZodValidationPipe(leaf.input).transform({ tenantId: TENANT_ID });
			} catch (error) {
				pipeRejected = error instanceof BadRequestException;
			}
			if (!unrecognized || !pipeRejected) {
				failures.push(`${leaf.path} accepted tenantId`);
			}
		}
		expect(failures).toEqual([]);
	});
});
