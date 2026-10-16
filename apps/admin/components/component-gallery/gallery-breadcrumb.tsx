"use client";

import * as React from "react";

import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";

export interface GalleryBreadcrumbProps {
	/** The component's exported name, shown as the last crumb instead of its slug. */
	readonly label: string;
}

/**
 * Names the last crumb of `/components/<slug>` after the component
 * (`Components › ButtonGroup`, not `› button-group`). Scoped to the pathname
 * by the provider, as on the user detail page.
 */
export function GalleryBreadcrumb({ label }: GalleryBreadcrumbProps): null {
	const { setTailLabel } = useAdminBreadcrumb();

	React.useEffect((): (() => void) => {
		setTailLabel(label);
		return (): void => {
			setTailLabel(null);
		};
	}, [setTailLabel, label]);

	return null;
}
