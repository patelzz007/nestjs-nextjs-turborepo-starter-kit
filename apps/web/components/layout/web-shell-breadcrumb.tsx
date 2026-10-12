"use client";

import Link from "next/link";
import * as React from "react";

import { useWebBreadcrumb } from "@/components/breadcrumb-provider";
import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { BreadcrumbTrail as SharedBreadcrumbTrail } from "@workspace/ui/components/breadcrumb-trail";
import { toastMessage } from "@workspace/ui/components/toast";
import { useIsDesktop } from "@workspace/ui/hooks/use-mobile";

/** Consumer shell breadcrumb — reads trail from context and renders the shared trail, on one line in the page header. */
export function WebShellBreadcrumb(): React.JSX.Element | null {
	const { status } = useWebBreadcrumb();
	const isDesktop = useIsDesktop();
	const maxItems = isDesktop ? 4 : 2;

	const renderLink = React.useCallback((item: BreadcrumbItem): React.ReactElement => {
		return <Link href={item.href ?? "#"} />;
	}, []);

	const handleCopy = React.useCallback((ok: boolean): void => {
		if (ok) {
			toastMessage.success({ title: "Link copied", description: "The page URL is on your clipboard." });
			return;
		}
		toastMessage.error({ title: "Could not copy link", description: "Copy the URL from the address bar instead." });
	}, []);

	if (status.kind === "ready" && status.items.length === 0) {
		return null;
	}

	return (
		<SharedBreadcrumbTrail
			className="mb-0 min-w-0"
			scrollable
			items={status.kind === "ready" ? status.items : []}
			status={status.kind}
			{...(status.kind === "error" ? { errorMessage: status.message } : {})}
			maxItems={maxItems}
			renderLink={renderLink}
			onCopy={handleCopy}
		/>
	);
}
