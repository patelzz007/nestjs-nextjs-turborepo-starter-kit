"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";
import { resolveAdminTrail, withTrailTailLabel } from "@/lib/navigation/breadcrumb";

/**
 * Smart breadcrumb bridge for data-driven pages (the /users/[id] demo).
 *
 * The route resolver produces URL-derived crumbs (`Users › 123`), but the
 * entity's real name is only known at runtime. This component overrides the
 * final crumb via `setItems` and restores the route-derived trail on cleanup.
 */
export function UserDetailBreadcrumb({ displayName }: { readonly displayName?: string }): React.JSX.Element | null {
	const pathname = usePathname();
	const { setItems, reset } = useAdminBreadcrumb();

	React.useEffect(() => {
		if (displayName === undefined) {
			return undefined;
		}
		setItems(withTrailTailLabel(resolveAdminTrail(pathname), displayName));
		return reset;
	}, [setItems, reset, pathname, displayName]);

	return null;
}
