"use client";

import { useWebSession } from "@/contexts/identity/components/web-authorization-provider";
import { IMPERSONATE_USER_PANEL_LABELS, type ImpersonateUserPanelLabels } from "@workspace/client/lib/contexts/identity/impersonation/impersonate-user-panel-labels";
import { ImpersonateUserPanel as SharedImpersonateUserPanel } from "@workspace/client/lib/contexts/identity/impersonation/impersonate-user-panel";
import type * as React from "react";

/** The web app's wording: impersonating switches this app's session. */
const WEB_LABELS: ImpersonateUserPanelLabels = { ...IMPERSONATE_USER_PANEL_LABELS, description: "Super-admin only. Switches your web session to the selected user." };

/** The shared super-admin impersonation panel, told whether this web session is already impersonating. */
export function ImpersonateUserPanel(): React.JSX.Element {
	const { session } = useWebSession();
	return <SharedImpersonateUserPanel isImpersonating={session?.isImpersonating === true} labels={WEB_LABELS} />;
}
