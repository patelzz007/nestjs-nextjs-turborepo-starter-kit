"use client";

import type { BreadcrumbItem, BreadcrumbStatus } from "@workspace/ui/components/breadcrumb-context";
import { BreadcrumbTrail } from "@workspace/ui/components/breadcrumb-trail";
import { toastMessage } from "@workspace/ui/components/toast";
import { useIsDesktop } from "@workspace/ui/hooks/use-mobile";
import Link from "next/link";
import { useCallback, type JSX, type ReactElement } from "react";

/** Crumbs shown before the trail collapses the middle ones. */
const DESKTOP_MAX_CRUMBS = 4;
const MOBILE_MAX_CRUMBS = 2;

/** The copy-link feedback of the trail. */
export interface ShellBreadcrumbLabels {
	readonly copiedTitle: string;
	readonly copiedDescription: string;
	readonly copyFailedTitle: string;
	readonly copyFailedDescription: string;
}

export const SHELL_BREADCRUMB_LABELS: ShellBreadcrumbLabels = {
	copiedTitle: "Link copied",
	copiedDescription: "The page URL is on your clipboard.",
	copyFailedTitle: "Could not copy link",
	copyFailedDescription: "Copy the URL from the address bar instead.",
};

export interface ShellBreadcrumbProps {
	/** The app's breadcrumb context status (`useBreadcrumb().status` of its provider). */
	readonly status: BreadcrumbStatus;
	/** The crumbs to show when they differ from the status's own (e.g. links an app's session may not open removed). */
	readonly items?: readonly BreadcrumbItem[];
	readonly labels?: ShellBreadcrumbLabels;
}

/**
 * Every app shell's breadcrumb: the route's trail on one line in the page header, Next.js links, the
 * middle crumbs collapsed on small screens, and copy-link feedback. A route without a trail (full-screen
 * pages) renders nothing.
 */
export function ShellBreadcrumb({ status, items, labels = SHELL_BREADCRUMB_LABELS }: ShellBreadcrumbProps): JSX.Element {
	const isDesktop = useIsDesktop();
	const crumbs = items ?? (status.kind === "ready" ? status.items : []);

	const renderLink = useCallback((item: BreadcrumbItem): ReactElement => <Link href={item.href ?? "#"} />, []);

	const handleCopy = useCallback(
		(ok: boolean): void => {
			if (ok) {
				toastMessage.success({ title: labels.copiedTitle, description: labels.copiedDescription });
				return;
			}
			toastMessage.error({ title: labels.copyFailedTitle, description: labels.copyFailedDescription });
		},
		[labels],
	);

	return (
		<BreadcrumbTrail
			className="mb-0 min-w-0"
			scrollable
			items={crumbs}
			status={status.kind}
			{...(status.kind === "error" ? { errorMessage: status.message } : {})}
			maxItems={isDesktop ? DESKTOP_MAX_CRUMBS : MOBILE_MAX_CRUMBS}
			renderLink={renderLink}
			onCopy={handleCopy}
		/>
	);
}
