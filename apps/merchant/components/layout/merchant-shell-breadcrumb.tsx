"use client";

import Link from "next/link";
import * as React from "react";

import { useMerchantBreadcrumb } from "@/components/common/merchant-breadcrumb";
import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import { BreadcrumbTrail as SharedBreadcrumbTrail } from "@workspace/ui/components/navigation/breadcrumb-trail";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useIsDesktop } from "@workspace/ui/hooks/use-mobile";

/** Merchant shell breadcrumb — reads trail from context and renders the shared trail. */
export function MerchantShellBreadcrumb(): React.JSX.Element {
	const { status } = useMerchantBreadcrumb();
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

	return (
		<div className="mb-5">
			<SharedBreadcrumbTrail
				items={status.kind === "ready" ? status.items : []}
				status={status.kind}
				errorMessage={status.kind === "error" ? status.message : undefined}
				maxItems={maxItems}
				renderLink={renderLink}
				onCopy={handleCopy}
			/>
		</div>
	);
}
