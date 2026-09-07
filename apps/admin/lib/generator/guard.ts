import { hasCapability, SessionPermissionsResponseSchema, toPlatformCapabilitySlug } from "@workspace/shared";

import { createAdminServerCaller } from "@/lib/admin-server-api";

/** Dev-only gate for the resource generator UI. */
export function isGeneratorUiEnabled(): boolean {
	if (process.env.ENABLE_GENERATOR_UI === "true") {
		return true;
	}
	return process.env.NODE_ENV === "development";
}

const GENERATOR_MANAGE_CAPABILITY = toPlatformCapabilitySlug("MANAGE", "DEVTOOLS");

/** Ensures the generator UI is enabled and the caller has devtools manage permission. */
export async function assertGeneratorAccess(): Promise<void> {
	if (!isGeneratorUiEnabled()) {
		throw new Error("Generator UI is only available in development.");
	}

	const server = createAdminServerCaller();
	const response = await server.auth.permissions.query(undefined);
	const parsed = SessionPermissionsResponseSchema.safeParse(response.data);
	if (!parsed.success) {
		throw new Error("Unable to verify session permissions.");
	}
	if (!parsed.data.hasAdminAccess) {
		throw new Error("Admin access is required to use the generator.");
	}
	if (!hasCapability(parsed.data.capabilities, GENERATOR_MANAGE_CAPABILITY)) {
		throw new Error("You do not have permission to use the resource generator.");
	}
}
