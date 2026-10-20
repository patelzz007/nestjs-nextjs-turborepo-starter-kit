"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { IMPERSONATE_USER_PANEL_LABELS, type ImpersonateUserPanelLabels } from "@workspace/client/lib/contexts/identity/impersonation/impersonate-user-panel-labels";
import { ImpersonateUserPanel as SharedImpersonateUserPanel } from "@workspace/client/lib/contexts/identity/impersonation/impersonate-user-panel";
import type * as React from "react";

/** The merchant portal's wording. */
const MERCHANT_LABELS: ImpersonateUserPanelLabels = {
	...IMPERSONATE_USER_PANEL_LABELS,
	title: "Impersonate merchant user",
	description: "Super-admin only. Switches your merchant portal session to the selected user.",
};

/** The shared super-admin impersonation panel, told whether this portal session is already impersonating. */
export function ImpersonateUserPanel(): React.JSX.Element {
	const { api } = useAuth();
	const permissionsQuery = api.auth.permissions.useQuery(undefined);
	return <SharedImpersonateUserPanel isImpersonating={permissionsQuery.data?.data.isImpersonating === true} labels={MERCHANT_LABELS} />;
}
