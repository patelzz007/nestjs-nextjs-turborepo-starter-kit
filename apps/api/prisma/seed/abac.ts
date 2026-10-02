import type { Permission } from "@prisma/client";
import { PolicyConditionsSchema, type PolicyConditions } from "@workspace/shared";

import { parsePrismaInputJson } from "../../src/common/utils/prisma-json";
import { prisma } from "./client";
import { seedLog } from "./seed-log";

// ---------------------------------------------------------------------------
// ABAC Demo — seed a condition on MANAGE:SYSTEM_SETTINGS
// ---------------------------------------------------------------------------
// This adds a runtime ABAC condition (policy DSL) to the MANAGE:SYSTEM_SETTINGS
// permission. The Authorization Kernel evaluates a grant's conditions after its
// scope matches; malformed conditions fail closed.
//
// The condition requires an authenticated subject id, so it always passes and
// demonstrates the pipeline without changing access. To see ABAC deny behavior,
// change it to one that fails, e.g.
//   { "condition": { "field": "$user.demoMode", "operator": "equals", "value": "enabled" } }

export async function seedAbacConditions(permissions: Permission[]): Promise<void> {
	const manageSystemSettings = permissions.find((p) => p.action === "MANAGE" && p.resource === "SYSTEM_SETTINGS" && p.scope === "GLOBAL");
	if (!manageSystemSettings) return;

	// Condition: the subject id must exist (always passes for authenticated users)
	const abacCondition: PolicyConditions = {
		condition: { field: "$user.userId", operator: "exists" },
	};

	await prisma.permission.update({
		where: { id: manageSystemSettings.id },
		data: { conditions: parsePrismaInputJson(PolicyConditionsSchema.parse(abacCondition)) },
	});

	seedLog(`  ABAC demo: Set condition on MANAGE:SYSTEM_SETTINGS → ${JSON.stringify(abacCondition)}`);
}
