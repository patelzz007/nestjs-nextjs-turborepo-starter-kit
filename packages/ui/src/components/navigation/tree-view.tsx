"use client";

import { Badge } from "@workspace/ui/components/feedback/badge";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/navigation/collapsible";
import { ScrollArea } from "@workspace/ui/components/navigation/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRight, File, Folder, FolderOpen, type LucideIcon } from "lucide-react";
import * as React from "react";
import { z } from "zod";

const booleanSchema = z.boolean();

const TREE_DEPTH_STEP_PX = 12;

const treeRowVariants = cva(
	"group/tree-row flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
	{
		variants: {
			state: {
				default: "hover:bg-accent/70 hover:text-accent-foreground",
				selected: "bg-primary/10 text-foreground ring-1 ring-primary/20",
			},
		},
		defaultVariants: {
			state: "default",
		},
	},
);

type TreeRowState = NonNullable<VariantProps<typeof treeRowVariants>["state"]>;

export interface TreeCheckboxConfig {
	readonly checked: boolean;
	readonly disabled?: boolean;
	readonly ariaLabel?: string;
	readonly onCheckedChange: (checked: boolean) => void;
}

function treeDepthStyle(depth: number): React.CSSProperties {
	return { paddingLeft: `${String(depth * TREE_DEPTH_STEP_PX)}px` };
}

interface TreeCheckboxSlotProps {
	readonly config: TreeCheckboxConfig;
}

function TreeCheckboxSlot({ config }: TreeCheckboxSlotProps): React.JSX.Element {
	const { checked, disabled, ariaLabel, onCheckedChange } = config;

	const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLSpanElement>): void => {
		event.stopPropagation();
	}, []);

	const handleCheckedChange = React.useCallback(
		(value: boolean): void => {
			const parsed = booleanSchema.safeParse(value);
			if (parsed.success) {
				onCheckedChange(parsed.data);
			}
		},
		[onCheckedChange],
	);

	return (
		<span className="flex shrink-0 items-center pe-0.5" onPointerDown={handlePointerDown}>
			<Checkbox checked={checked} disabled={disabled} aria-label={ariaLabel} onCheckedChange={handleCheckedChange} className="size-4" />
		</span>
	);
}

export interface TreeViewProps extends React.ComponentProps<"div"> {
	readonly scrollable?: boolean;
	readonly heightClassName?: string;
}

/**
 * File-explorer style tree container (shadcn sidebar-11 pattern).
 */
const TreeView = React.forwardRef<HTMLDivElement, TreeViewProps>(function TreeView(
	{ className, children, scrollable = false, heightClassName = "h-[min(32rem,60vh)]", ...props },
	ref,
): React.JSX.Element {
	const tree = (
		<div role="tree" className="flex flex-col gap-0.5 p-2">
			{children}
		</div>
	);

	if (!scrollable) {
		return (
			<div ref={ref} className={cn("rounded-lg border border-border bg-muted/20", className)} {...props}>
				{tree}
			</div>
		);
	}

	return (
		<ScrollArea ref={ref} className={cn("rounded-lg border border-border bg-muted/20", heightClassName, className)} {...props}>
			{tree}
		</ScrollArea>
	);
});

export interface TreeBranchProps {
	readonly name: string;
	readonly depth?: number;
	readonly defaultOpen?: boolean;
	readonly open?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
	readonly count?: number;
	readonly suffix?: React.ReactNode;
	readonly checkbox?: TreeCheckboxConfig;
	readonly children: React.ReactNode;
	readonly className?: string;
}

/**
 * Expandable folder row with chevron + folder icon.
 */
const TreeBranch = React.forwardRef<HTMLDivElement, TreeBranchProps>(function TreeBranch(
	{ name, depth = 0, defaultOpen = false, open: openProp, onOpenChange, count, suffix, checkbox, children, className },
	ref,
): React.JSX.Element {
	const [openState, setOpenState] = React.useState(defaultOpen);
	const open = openProp ?? openState;

	const handleOpenChange = React.useCallback(
		(nextOpen: boolean): void => {
			if (openProp === undefined) {
				setOpenState(nextOpen);
			}
			if (onOpenChange !== undefined) {
				onOpenChange(nextOpen);
			}
		},
		[onOpenChange, openProp],
	);

	const FolderIcon = open ? FolderOpen : Folder;

	return (
		<div ref={ref} role="treeitem" aria-expanded={open} className={cn("min-w-0", className)} style={treeDepthStyle(depth)}>
			<Collapsible open={open} onOpenChange={handleOpenChange}>
				<div className="flex min-w-0 items-center gap-0.5">
					{checkbox !== undefined ? <TreeCheckboxSlot config={checkbox} /> : null}
					<CollapsibleTrigger className={cn(treeRowVariants(), "min-w-0 flex-1 text-start font-medium")}>
						<ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open ? "rotate-90" : "")} aria-hidden="true" />
						<FolderIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
						<span className="min-w-0 flex-1 truncate">{name}</span>
						{count !== undefined ? (
							<Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
								{String(count)}
							</Badge>
						) : null}
						{suffix}
					</CollapsibleTrigger>
				</div>
				<CollapsibleContent>
					<div className="relative ms-4 border-s border-border/80 ps-2">{children}</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
});

export interface TreeLeafProps extends Omit<React.ComponentProps<"div">, "children" | "onClick"> {
	readonly name: string;
	readonly depth?: number;
	readonly state?: TreeRowState;
	readonly mono?: boolean;
	readonly hint?: string | null;
	readonly icon?: LucideIcon;
	readonly iconClassName?: string;
	readonly suffix?: React.ReactNode;
	readonly checkbox?: TreeCheckboxConfig;
	readonly onSelect?: () => void;
}

/**
 * Leaf row with file icon — used for terminal nodes in the tree.
 */
const TreeLeaf = React.forwardRef<HTMLDivElement, TreeLeafProps>(function TreeLeaf(
	{ name, depth = 0, state = "default", mono = false, hint, icon: Icon = File, iconClassName, suffix, checkbox, onSelect, className, title, ...props },
	ref,
): React.JSX.Element {
	const resolvedTitle = hint !== undefined && hint !== null && hint.length > 0 ? hint : title;
	const isInteractive = onSelect !== undefined;

	const handleClick = React.useCallback((): void => {
		if (onSelect !== undefined) {
			onSelect();
		}
	}, [onSelect]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			if (!isInteractive) {
				return;
			}
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				onSelect();
			}
		},
		[isInteractive, onSelect],
	);

	return (
		<div
			ref={ref}
			role="treeitem"
			tabIndex={isInteractive ? 0 : undefined}
			title={resolvedTitle}
			className={cn(treeRowVariants({ state }), isInteractive ? "cursor-pointer" : undefined, className)}
			style={treeDepthStyle(depth)}
			onClick={isInteractive ? handleClick : undefined}
			onKeyDown={isInteractive ? handleKeyDown : undefined}
			{...props}>
			{checkbox !== undefined ? <TreeCheckboxSlot config={checkbox} /> : <span className="size-4 shrink-0" aria-hidden="true" />}
			<Icon className={cn("size-4 shrink-0", iconClassName ?? "text-muted-foreground")} aria-hidden="true" />
			<span className={cn("min-w-0 flex-1 truncate", mono ? "font-mono text-xs tracking-wide" : "text-sm")}>{name}</span>
			{suffix}
		</div>
	);
});

export { TreeView, TreeBranch, TreeLeaf, treeRowVariants };
