"use client";

import * as React from "react";

import { useWebBreadcrumb } from "@/components/breadcrumb-provider";

export interface WebBreadcrumbTailLabelProps {
	/** The entity's display name (e.g. a reward's title). `undefined` keeps the route-derived label. */
	readonly label: string | undefined;
}

/**
 * Breadcrumb bridge for data-driven pages: the route resolver can only label
 * a detail page generically (`Browse Rewards › Reward`), so the page renders
 * this with the entity's real name. The label is cleared on unmount, and the
 * provider scopes it to the current pathname, so it never reaches another page.
 */
export function WebBreadcrumbTailLabel({ label }: WebBreadcrumbTailLabelProps): React.JSX.Element | null {
	const { setTailLabel } = useWebBreadcrumb();

	React.useEffect((): (() => void) | undefined => {
		if (label === undefined) {
			return undefined;
		}
		setTailLabel(label);
		return (): void => {
			setTailLabel(null);
		};
	}, [label, setTailLabel]);

	return null;
}
