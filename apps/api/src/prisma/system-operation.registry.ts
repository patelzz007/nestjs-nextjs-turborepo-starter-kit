/** Allowlisted system operations that may bypass tenant RLS. */
export const SYSTEM_OPERATIONS: Readonly<Record<string, { readonly description: string; readonly role: string }>> = {
	"outbox.publish": { description: "Publish outbox events to Kafka", role: "app_runtime" },
	"tenant.enumerate": { description: "List active organization IDs for schedulers", role: "app_enumerator" },
	"organization.provision": { description: "Organization provisioning saga steps", role: "app_runtime" },
	"organization.location.onboarding_finalize": { description: "Finalize primary and additional stores after merchant onboarding", role: "app_runtime" },
	"organization.location.admin_create": { description: "RewardHub admin creates an organization store location", role: "app_runtime" },
	"organization.location.admin_review": { description: "RewardHub admin approves or rejects a store location request", role: "app_runtime" },
	"organization.location.admin_list": { description: "RewardHub admin lists pending store location requests", role: "app_runtime" },
	"organization.erase": { description: "Verified tenant erasure", role: "app_worker" },
	"policy.publish": { description: "Atomic policy version publication", role: "app_runtime" },
	"seed.bootstrap": { description: "Database seed scripts", role: "app_runtime" },
	"auth.pre_login": { description: "Pre-authentication user lookup", role: "app_runtime" },
	"health.probe": { description: "Health check database probe", role: "app_runtime" },
};

export function isAllowlistedSystemOperation(operation: string): boolean {
	return Object.prototype.hasOwnProperty.call(SYSTEM_OPERATIONS, operation);
}
