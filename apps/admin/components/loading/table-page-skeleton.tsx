import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { PageHeaderSkeleton, TableSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import type { SkeletonRegionLabelsOverride } from "@/components/loading/loading-labels";

/** Body rows drawn under the header — enough to fill the first viewport; rows below the fold never show. */
export const TABLE_PAGE_SKELETON_ROWS = 10;

/** The silhouette of one table index page — kept beside the skeleton so every route that shares it agrees. */
export interface TablePageShape {
	/** Rendered table columns, counting the selection and row-action columns the `DataTable` adds. */
	readonly columns: number;
	/** Buttons on the right of the page header (e.g. "New product", "Refresh"). */
	readonly actions: number;
	/** Lead each row with an avatar (people, merchants). */
	readonly withAvatar: boolean;
	/** The table card's header has a `CardDescription` under its title. */
	readonly withCardDescription: boolean;
	/** The page wrapper's own width classes (e.g. `mx-auto w-full max-w-7xl`), so the table starts where the page's does. */
	readonly className: string;
}

/** `/users` — select + Name, Email, Roles, Referrer, Referral status, Access + row actions. */
export const USERS_TABLE_PAGE: TablePageShape = { columns: 8, actions: 0, withAvatar: false, withCardDescription: false, className: "" };
/** `/merchants` — select + Business, City, Category, Contact, KYB, Status + row actions. */
export const MERCHANTS_TABLE_PAGE: TablePageShape = { columns: 8, actions: 0, withAvatar: false, withCardDescription: false, className: "" };
/** `/catalog/products` — select + eight product columns + row actions; "New Product" in the header. */
export const PRODUCTS_TABLE_PAGE: TablePageShape = { columns: 10, actions: 1, withAvatar: false, withCardDescription: false, className: "" };
/** `/catalog/categories` — select + five category columns + row actions; "New Category" in the header. */
export const CATEGORIES_TABLE_PAGE: TablePageShape = { columns: 7, actions: 1, withAvatar: false, withCardDescription: false, className: "" };
/** `/audit-logs` — Time, Request, Outcome, Actor, Organization, Device, Client; "Refresh" in the header. */
export const AUDIT_LOG_TABLE_PAGE: TablePageShape = { columns: 7, actions: 1, withAvatar: false, withCardDescription: true, className: "mx-auto w-full max-w-7xl" };
/** `/emails/log` — select + Subject, To, Status, Sent at; the live pill and "Refresh" in the header. */
export const EMAIL_LOG_TABLE_PAGE: TablePageShape = { columns: 5, actions: 2, withAvatar: false, withCardDescription: true, className: "mx-auto w-full max-w-7xl" };
/** `/users/mfa-recovery` — select + User, Status, Requested + row actions. */
export const MFA_RECOVERY_TABLE_PAGE: TablePageShape = { columns: 5, actions: 0, withAvatar: false, withCardDescription: true, className: "" };

export interface TablePageSkeletonProps {
	/** What the region announces, e.g. `{ loading: "Loading users…" }` — a module constant. */
	readonly labels: SkeletonRegionLabelsOverride;
	readonly shape: TablePageShape;
}

/**
 * The admin's table index page while it loads: the `h1` + subtitle header
 * (+ its actions) over a card-wrapped `DataTable` — the shape of
 * `<header/> <Card><CardHeader><CardTitle/></CardHeader><CardContent><DataTable/></CardContent></Card>`
 * every list page renders.
 */
export function TablePageSkeleton({ labels, shape }: TablePageSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className={cn("flex flex-col gap-6", shape.className)}>
			<PageHeaderSkeleton actions={shape.actions} />
			<TableSkeleton rows={TABLE_PAGE_SKELETON_ROWS} columns={shape.columns} withAvatar={shape.withAvatar} withDescription={shape.withCardDescription} />
		</SkeletonRegion>
	);
}
