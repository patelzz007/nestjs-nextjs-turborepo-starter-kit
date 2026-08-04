"use client";

import { BookOpen } from "lucide-react";
import * as React from "react";

import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";

/**
 * Smart breadcrumb bridge for the docs detail page. The `/docs/<slug>` route
 * resolves generically through the menu ("Docs Home › <humanized slug>"), but
 * the server page knows the guide's real frontmatter title. This client
 * wrapper overrides the trail with the accurate title while mounted and
 * `reset()`s on unmount so navigating away restores the route-derived trail.
 */
export function DocBreadcrumbBridge({ title, href }: { readonly title: string; readonly href: string }): React.JSX.Element | null {
	const { setItems, reset } = useAdminBreadcrumb();

	React.useEffect(() => {
		setItems([
			{ label: "Docs Home", href: "/docs", icon: BookOpen },
			{ label: title, icon: BookOpen, href },
		]);
		return reset;
	}, [setItems, reset, title, href]);

	return null;
}
