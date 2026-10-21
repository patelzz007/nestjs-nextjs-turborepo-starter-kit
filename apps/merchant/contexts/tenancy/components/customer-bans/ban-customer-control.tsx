"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { TENANT_CUSTOMER_BAN_REASON_MAX_LENGTH } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { toastMessage } from "@workspace/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

export interface BanCustomerControlProps {
	readonly tenantSlug: string;
	/** The redemption the customer is recognised by; the API resolves the customer from it. */
	readonly redemptionId: string;
}

/**
 * `POST /tenants/:tenantSlug/customer-bans` from one row of the redemption log: asks for a reason
 * (kept for staff, never shown to the customer), then bans the customer behind the redemption from
 * the merchant's rewards. Shown only with `merchant:manage_rewards` (the API enforces it).
 */
export const BanCustomerControl = React.forwardRef<HTMLDivElement, BanCustomerControlProps>(function BanCustomerControl({ tenantSlug, redemptionId }, ref): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [open, setOpen] = React.useState(false);
	const [reason, setReason] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);
	const fieldId = `ban-reason-${redemptionId}`;
	const ban = api.tenants.banCustomer.useMutation({
		onSuccess: async () => {
			setOpen(false);
			setReason("");
			toastMessage.success({ title: "Customer banned", description: "They can no longer claim or redeem your rewards." });
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.tenants.redemptions.scopeKey({ tenantSlug }) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.tenants.customerBans.scopeKey({ tenantSlug }) }),
			]);
		},
		onError: (caught) => {
			setError(resolveAuthErrorMessage(caught));
		},
	});
	const { mutate: banCustomer } = ban;

	const handleOpen = React.useCallback((): void => {
		setError(null);
		setOpen(true);
	}, []);
	const handleCancel = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const handleReasonChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setReason(event.target.value);
	}, []);
	const handleBan = React.useCallback((): void => {
		setError(null);
		banCustomer({ tenantSlug, redemptionId, reason: reason.trim() });
	}, [banCustomer, reason, redemptionId, tenantSlug]);

	return (
		<div ref={ref} className="space-y-2">
			{open ? (
				<div className="space-y-2">
					<Label htmlFor={fieldId}>Why is this customer banned? Only your staff see this.</Label>
					<Textarea id={fieldId} value={reason} onChange={handleReasonChange} maxLength={TENANT_CUSTOMER_BAN_REASON_MAX_LENGTH} />
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="destructive" size="sm" onClick={handleBan} disabled={ban.isPending || reason.trim().length === 0}>
							Ban customer
						</Button>
						<Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={ban.isPending}>
							Cancel
						</Button>
					</div>
				</div>
			) : (
				<Button type="button" variant="outline" size="sm" onClick={handleOpen}>
					Ban this customer
				</Button>
			)}
			{error !== null ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
});
