"use client";

import * as React from "react";

import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";

/**
 * Names the final crumb of a data-driven page (a user's or a kanban item's
 * page) once the record has loaded. The route resolver only knows the URL
 * (`Users › 0199…`); this swaps the id for the record's name. The label is
 * scoped to the current pathname by the provider, so route resolution can't
 * overwrite it and it never leaks onto another page.
 */
export function DetailBreadcrumb({ label }: { readonly label?: string | undefined }): React.JSX.Element | null {
	const { setTailLabel } = useAdminBreadcrumb();

	React.useEffect((): (() => void) | undefined => {
		if (label === undefined) {
			return undefined;
		}
		setTailLabel(label);
		return (): void => {
			setTailLabel(null);
		};
	}, [setTailLabel, label]);

	return null;
}
