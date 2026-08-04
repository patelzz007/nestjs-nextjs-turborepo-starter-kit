"use client";

import * as React from "react";

import Link from "next/link";

import { BreadcrumbTrail as SharedBreadcrumbTrail } from "@workspace/ui/components/breadcrumb-trail";
import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";

import { useWebBreadcrumb } from "@/components/breadcrumb-provider";

/**
 * The web app's breadcrumb trail. Reads the trail (and its status) from the
 * `BreadcrumbContext` and renders the **shared** presentational trail with a
 * Next.js `Link` renderer. Returns nothing on routes with no trail (e.g. the
 * full-screen auth pages).
 */
export function BreadcrumbTrail(): React.JSX.Element | null {
	const { status } = useWebBreadcrumb();

	const renderLink = React.useCallback((item: BreadcrumbItem): React.ReactElement => {
		return <Link href={item.href ?? "#"} />;
	}, []);

	return (
		<SharedBreadcrumbTrail
			items={status.kind === "ready" ? status.items : []}
			status={status.kind}
			errorMessage={status.kind === "error" ? status.message : undefined}
			renderLink={renderLink}
		/>
	);
}
