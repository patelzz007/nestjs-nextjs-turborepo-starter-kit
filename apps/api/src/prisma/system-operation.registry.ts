/** Allowlisted system operations that may bypass tenant RLS. */
export const SYSTEM_OPERATIONS: Readonly<Record<string, { readonly description: string; readonly role: string }>> = {
	"outbox.publish": { description: "Publish outbox events to Kafka", role: "app_runtime" },
	"outbox.enqueue": { description: "Record a platform event in the transactional outbox", role: "app_runtime" },
	"tenant.enumerate": { description: "List active organization IDs for schedulers", role: "app_enumerator" },
	"organization.provision": { description: "Organization provisioning saga steps", role: "app_runtime" },
	"organization.membership.invite": { description: "Create, revoke, and resolve team member invitations", role: "app_runtime" },
	"organization.membership.accept": { description: "Accept a team member invitation and create membership", role: "app_runtime" },
	"organization.location.onboarding_finalize": { description: "Finalize primary and additional stores after merchant onboarding", role: "app_runtime" },
	"organization.location.admin_create": { description: "RewardHub admin creates an organization store location", role: "app_runtime" },
	"organization.location.admin_review": { description: "RewardHub admin approves or rejects a store location request", role: "app_runtime" },
	"organization.location.admin_list": { description: "RewardHub admin lists pending store location requests", role: "app_runtime" },
	"organization.erase": { description: "Verified tenant erasure", role: "app_worker" },
	"policy.publish": { description: "Atomic policy version publication", role: "app_runtime" },
	"seed.bootstrap": { description: "Database seed scripts", role: "app_runtime" },
	"auth.pre_login": { description: "Pre-authentication user lookup", role: "app_runtime" },
	"files.upload_authorization": { description: "Resolve the uploader's organization role for upload-url authorization", role: "app_runtime" },
	"health.probe": { description: "Health check database probe", role: "app_runtime" },
	"request.pre_handler": { description: "Authentication + authorization lookups before the RLS interceptor narrows the request", role: "app_runtime" },
	"queue.job": { description: "Background queue job processing (BullMQ workers)", role: "app_runtime" },
	"scheduled.maintenance": { description: "Cron maintenance tasks (expiry and retention cleanup)", role: "app_runtime" },
	"route.rls_bypass": { description: "Handler explicitly decorated with @RlsBypass() (public cross-tenant flows)", role: "app_runtime" },
	"platform.superadmin": { description: "Platform super-admin request scope", role: "app_runtime" },
	"platform.staff_single_tenant": { description: "Admin staff in single-tenant mode", role: "app_runtime" },
	"storage.callback": { description: "Storage processing callbacks and local-driver transfers", role: "app_runtime" },
};

export function isAllowlistedSystemOperation(operation: string): boolean {
	return Object.prototype.hasOwnProperty.call(SYSTEM_OPERATIONS, operation);
}
