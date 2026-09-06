"use client";

import {
	permissionActionBadgeVariant,
	permissionActionFallbackIcon,
	permissionActionIcon,
	permissionActionIconClassName,
	permissionActionSummary,
} from "@/lib/permission-action-style";
import { PermissionActionSchema, type PermissionAction } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Separator } from "@workspace/ui/components/display/separator";
import { ScrollArea } from "@workspace/ui/components/navigation/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { FolderTree, KeyRound, Layers3, ShieldCheck } from "lucide-react";
import * as React from "react";

export interface AccessPermissionDetailItem {
	readonly id: string;
	readonly action: string;
	readonly resource: string;
	readonly description: string | null;
	readonly group: string;
	readonly isSystem: boolean;
}

export interface AccessPermissionDetailPanelProps {
	readonly permission: AccessPermissionDetailItem | null;
	readonly relatedActions: readonly string[];
	readonly totalCount: number;
	readonly visibleCount: number;
	readonly onSelectRelatedAction?: (action: string) => void;
	readonly className?: string;
}

function parsePermissionAction(action: string): PermissionAction | null {
	const parsed = PermissionActionSchema.safeParse(action);
	return parsed.success ? parsed.data : null;
}

function formatResourceLabel(resource: string): string {
	return resource
		.split("_")
		.map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
		.join(" ");
}

interface DetailFieldProps {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
}

const DetailField = React.forwardRef<HTMLDivElement, DetailFieldProps>(function DetailField({ label, value, mono = false }, ref): React.JSX.Element {
	return (
		<div ref={ref} className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
			<p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
			<p className={cn("text-sm text-foreground", mono ? "font-mono text-xs break-all" : "font-medium")}>{value}</p>
		</div>
	);
});

interface RelatedActionButtonProps {
	readonly action: string;
	readonly variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
	readonly onSelect: (action: string) => void;
}

const RelatedActionButton = React.forwardRef<HTMLButtonElement, RelatedActionButtonProps>(function RelatedActionButton({ action, variant, onSelect }, ref): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(action);
	}, [action, onSelect]);

	return (
		<button ref={ref} type="button" className="rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none" onClick={handleClick}>
			<Badge variant={variant} className="cursor-pointer font-mono text-[10px] tracking-wide hover:opacity-80">
				{action}
			</Badge>
		</button>
	);
});

/**
 * Permission inspector shown beside the catalog tree.
 */
export const AccessPermissionDetailPanel = React.forwardRef<HTMLDivElement, AccessPermissionDetailPanelProps>(function AccessPermissionDetailPanel(
	{ permission, relatedActions, totalCount, visibleCount, onSelectRelatedAction, className },
	ref,
): React.JSX.Element {
	if (permission === null) {
		return (
			<Card ref={ref} className={cn("flex min-h-[min(36rem,65vh)] flex-col justify-center border-dashed bg-muted/10", className)}>
				<CardContent className="flex flex-col items-center px-6 py-10 text-center">
					<div className="flex size-12 items-center justify-center rounded-full bg-muted">
						<KeyRound className="size-5 text-muted-foreground" aria-hidden="true" />
					</div>
					<p className="mt-4 text-base font-medium text-foreground">Select a permission</p>
					<CardDescription className="mt-2 max-w-xs text-sm leading-relaxed">
						Choose any action in the tree to review its scope, resource binding, and description.
					</CardDescription>
					<p className="mt-6 text-xs text-muted-foreground tabular-nums">
						Catalog: {String(visibleCount)} visible · {String(totalCount)} total
					</p>
				</CardContent>
			</Card>
		);
	}

	const parsedAction = parsePermissionAction(permission.action);
	const ActionIcon = parsedAction !== null ? permissionActionIcon(parsedAction) : permissionActionFallbackIcon();
	const iconClassName = parsedAction !== null ? permissionActionIconClassName(parsedAction) : "text-muted-foreground";
	const badgeVariant = parsedAction !== null ? permissionActionBadgeVariant(parsedAction) : "outline";
	const actionSummary = parsedAction !== null ? permissionActionSummary(parsedAction) : "Defines access for a specific action on a resource.";
	const permissionKey = `${permission.action}:${permission.resource}`;
	const resourceLabel = formatResourceLabel(permission.resource);
	const hasDescription = permission.description !== null && permission.description.length > 0;

	return (
		<Card ref={ref} className={cn("flex min-h-[min(36rem,65vh)] flex-col overflow-hidden", className)}>
			<CardHeader className="border-b bg-muted/15 pb-5">
				<div className="flex items-start gap-4">
					<div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl bg-background ring-1 ring-border", iconClassName)}>
						<ActionIcon className="size-5" aria-hidden="true" />
					</div>
					<div className="min-w-0 flex-1 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant={badgeVariant} className="font-mono text-[11px] tracking-wide">
								{permission.action}
							</Badge>
							<span className="text-xs text-muted-foreground">on</span>
							<Badge variant="outline" className="font-mono text-[11px] tracking-wide">
								{permission.resource}
							</Badge>
							{permission.isSystem ? (
								<Badge variant="secondary" className="gap-1 text-[10px]">
									<ShieldCheck className="size-3" aria-hidden="true" />
									System
								</Badge>
							) : null}
						</div>
						<CardTitle className="text-lg leading-snug">{permission.group}</CardTitle>
						<CardDescription className="text-sm">{resourceLabel}</CardDescription>
					</div>
				</div>
			</CardHeader>

			<ScrollArea className="flex-1">
				<CardContent className="space-y-6 py-6">
					<section className="space-y-2">
						<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Permission key</p>
						<div className="rounded-lg border border-border bg-muted/30 px-4 py-3 font-mono text-sm tracking-wide text-foreground">{permissionKey}</div>
					</section>

					<section className="space-y-3">
						<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What this grants</p>
						<p className="text-sm leading-relaxed text-foreground">{actionSummary}</p>
						{hasDescription ? (
							<div className="rounded-lg border border-border/70 bg-background px-4 py-3">
								<p className="text-sm leading-relaxed text-muted-foreground">{permission.description}</p>
							</div>
						) : (
							<p className="text-sm text-muted-foreground italic">No custom description has been added for this permission.</p>
						)}
					</section>

					<Separator />

					<section className="space-y-3">
						<p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
							<Layers3 className="size-3.5" aria-hidden="true" />
							Metadata
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<DetailField label="Action" value={permission.action} mono />
							<DetailField label="Resource" value={permission.resource} mono />
							<DetailField label="Group" value={permission.group} />
							<DetailField label="Permission ID" value={permission.id} mono />
						</div>
					</section>

					{relatedActions.length > 0 ? (
						<section className="space-y-3">
							<p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								<FolderTree className="size-3.5" aria-hidden="true" />
								Other actions on {permission.resource}
							</p>
							<div className="flex flex-wrap gap-2">
								{relatedActions.map((action) => {
									const relatedParsed = parsePermissionAction(action);
									const relatedVariant = relatedParsed !== null ? permissionActionBadgeVariant(relatedParsed) : "outline";
									const isCurrent = action === permission.action;

									if (onSelectRelatedAction !== undefined && !isCurrent) {
										return <RelatedActionButton key={action} action={action} variant={relatedVariant} onSelect={onSelectRelatedAction} />;
									}

									return (
										<Badge key={action} variant={isCurrent ? relatedVariant : "outline"} className="font-mono text-[10px] tracking-wide">
											{action}
										</Badge>
									);
								})}
							</div>
						</section>
					) : null}
				</CardContent>
			</ScrollArea>
		</Card>
	);
});
