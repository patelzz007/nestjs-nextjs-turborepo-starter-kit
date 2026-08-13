import type { Permission } from "@prisma/client";

import { prisma } from "./client";

// ---------------------------------------------------------------------------
// ABAC Demo — seed a condition on MANAGE:SYSTEM_SETTINGS
// ---------------------------------------------------------------------------
// This adds a runtime ABAC condition to the MANAGE:SYSTEM_SETTINGS permission.
// The condition requires that the authenticated user's email exists (which
// every authenticated user has). This demonstrates the ABAC evaluation
// pipeline in the PermissionsGuard without breaking existing functionality.
//
// To test: Log in as Frank Miller (frank.miller@example.com, Frank@123) who
// has MANAGE:SYSTEM_SETTINGS via direct grant. The guard will evaluate the
// condition {field: "user.email", operator: "exists", value: ""} at runtime.
// Since Frank has an email, the condition passes and he can access the resource.
//
// To see ABAC deny behavior: Change the condition via the PATCH API to one
// that fails, e.g.:
//   PATCH /rbac/permissions/<MANAGE:SYSTEM_SETTINGS's id>
//   Body: { "conditions": { "field": "extra.demoMode", "operator": "eq", "value": "enabled" } }
// Since extra is always {}, the condition fails and access is denied.

export async function seedAbacConditions(permissions: Permission[]): Promise<void> {
	const manageSystemSettings = permissions.find((p) => p.action === "MANAGE" && p.resource === "SYSTEM_SETTINGS");
	if (!manageSystemSettings) return;

	// Condition: user.email must exist (always passes for authenticated users)
	const abacCondition = {
		field: "user.email",
		operator: "exists",
		value: "",
	};

	await prisma.permission.update({
		where: { id: manageSystemSettings.id },
		data: { conditions: abacCondition },
	});

	console.log(`  ABAC demo: Set condition on MANAGE:SYSTEM_SETTINGS → ${JSON.stringify(abacCondition)}`);
}
