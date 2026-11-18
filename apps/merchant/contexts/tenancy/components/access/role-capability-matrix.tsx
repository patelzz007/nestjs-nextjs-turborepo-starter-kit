"use client";

import { samePermission } from "@/contexts/tenancy/lib/access/permission-labels";
import { MERCHANT_CAPABILITY_PERMISSION, MerchantCapabilitySchema, type MerchantCapability, type TenantRoleResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { CircleCheck, SlidersHorizontal } from "lucide-react";
import * as React from "react";

/** What each merchant capability lets a member do, in the owner's words. */
export const CAPABILITY_LABELS: Readonly<Record<MerchantCapability, string>> = {
	"merchant:view_dashboard": "See the dashboard",
	"merchant:view_rewards": "View rewards",
	"merchant:create_rewards": "Create rewards",
	"merchant:manage_rewards": "Edit rewards",
	"merchant:publish_rewards": "Submit rewards for review",
	"merchant:view_customer_bans": "See banned customers",
	"merchant:ban_customers": "Ban customers",
	"merchant:lift_customer_bans": "Lift customer bans",
	"merchant:view_redemptions": "View redemptions",
	"merchant:view_api_keys": "See API keys and till settings",
	"merchant:manage_api_keys": "Create API keys and change till settings",
	"merchant:revoke_api_keys": "Revoke API keys",
	"merchant:view_terminals": "See tills",
	"merchant:manage_terminals": "Register and pair tills",
	"merchant:remove_terminals": "Remove tills",
	"merchant:view_analytics": "View analytics",
	"merchant:view_team": "See the team",
	"merchant:manage_team": "Manage the team and its roles",
	"merchant:invite_members": "Invite members",
	"merchant:revoke_invites": "Revoke invitations",
	"merchant:approve_access_requests": "Approve join requests",
	"merchant:reject_access_requests": "Reject join requests",
	"merchant:view_locations": "View stores",
	"merchant:manage_locations": "Manage stores and branding",
	"merchant:view_verification": "See business verification",
	"merchant:manage_verification": "Submit business verification",
	"merchant:view_notifications": "See what the business sent customers",
	"merchant:view_broadcasts": "See announcements",
	"merchant:create_broadcasts": "Draft announcements",
	"merchant:manage_broadcasts": "Edit announcements",
	"merchant:publish_broadcasts": "Send and approve announcements",
	"merchant:view_payments": "See payments",
	"merchant:manage_payments": "Take payments",
	"merchant:refund_payments": "Refund payments",
	"merchant:view_webhooks": "See webhooks",
	"merchant:create_webhooks": "Add webhooks",
	"merchant:manage_webhooks": "Change webhooks",
	"merchant:delete_webhooks": "Delete webhooks",
};

/** Whether `role` gives `capability` (its permission is among the role's). */
export function roleGives(role: Pick<TenantRoleResponse, "permissions">, capability: MerchantCapability): boolean {
	const permission = MERCHANT_CAPABILITY_PERMISSION[capability];
	return role.permissions.some((held) => samePermission(held, permission));
}

export interface RoleCapabilityMatrixProps {
	readonly roles: readonly TenantRoleResponse[];
	/** Opens the roles, to change what they give. */
	readonly onCustomise: () => void;
}

/** "What each role can do": one row per capability, one column per role — a tick when the role gives it. */
export function RoleCapabilityMatrix({ roles, onCustomise }: RoleCapabilityMatrixProps): React.JSX.Element {
	return (
		<section aria-labelledby="role-matrix-heading" className="overflow-hidden rounded-xl border border-border bg-card">
			<div className="flex flex-wrap items-start justify-between gap-3 p-5">
				<div className="space-y-0.5">
					<h3 id="role-matrix-heading" className="text-base font-semibold text-foreground">
						What each role can do
					</h3>
					<p className="text-sm text-muted-foreground">Extra permissions given to one member come on top of their role.</p>
				</div>
				<Button type="button" variant="ghost" size="sm" onClick={onCustomise}>
					<SlidersHorizontal data-icon="inline-start" />
					Customise roles
				</Button>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[32rem] text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th scope="col" className="px-5 py-3 text-left font-medium">
								Permission
							</th>
							{roles.map((role) => (
								<th key={role.id} scope="col" className="px-3 py-3 text-center font-medium">
									{role.name}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{MerchantCapabilitySchema.options.map((capability) => (
							<tr key={capability}>
								<th scope="row" className="px-5 py-3 text-left font-normal text-foreground">
									{CAPABILITY_LABELS[capability]}
								</th>
								{roles.map((role) => (
									<td key={role.id} className="px-3 py-3 text-center">
										{roleGives(role, capability) ? (
											<CircleCheck aria-label="Yes" className="mx-auto size-4.5 text-success" />
										) : (
											<span aria-label="No" className="text-muted-foreground">
												—
											</span>
										)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
