"use client";

import { UserRound, UsersRound } from "lucide-react";
import * as React from "react";

import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";

/**
 * Smart breadcrumb bridge for data-driven pages (the /users/[id] demo).
 *
 * The route resolver can only produce URL-derived crumbs ("Users › 123"),
 * but the entity's real name is only known at runtime. This component:
 *
 * 1. derives a display name for the user id (in a real app this would come
 *    from `api.procedure(...).useQuery()` — see `apps/api` modules),
 * 2. overrides the trail with `setItems` so the current page crumb shows the
 *    entity name,
 * 3. returns `reset` as the effect cleanup so navigating away restores the
 *    route-derived trail.
 *
 * Follows the rules: data lives in the smart component (the page) and is
 * passed down; the bridge only wires it into the breadcrumb context.
 */
export function UserDetailBreadcrumb({ userId }: { readonly userId: string }): React.JSX.Element | null {
	const { setItems, reset } = useAdminBreadcrumb();

	React.useEffect(() => {
		// DEMO: deterministic display name from the id. In a real app, fetch
		// the user (`GET /users/:id`) and use `user.fullName`.
		const displayName = `User ${userId}`;
		setItems([
			{ label: "Users", href: "/users", icon: UsersRound },
			{ label: displayName, icon: UserRound },
		]);
		return reset;
	}, [setItems, reset, userId]);

	return null;
}
