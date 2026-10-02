"use client";

import * as React from "react";

import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";

/**
 * Smart breadcrumb bridge for data-driven pages (the /users/[id] page).
 *
 * The route resolver produces URL-derived crumbs (`Users › 123`); the user's
 * real name is only known at runtime, so this names the final crumb with it.
 * The label is scoped to the current pathname by the provider, so it can't be
 * overwritten by route resolution and never leaks onto another page.
 */
export function UserDetailBreadcrumb({ displayName }: { readonly displayName?: string | undefined }): React.JSX.Element | null {
	const { setTailLabel } = useAdminBreadcrumb();

	React.useEffect((): (() => void) | undefined => {
		if (displayName === undefined) {
			return undefined;
		}
		setTailLabel(displayName);
		return (): void => {
			setTailLabel(null);
		};
	}, [setTailLabel, displayName]);

	return null;
}
