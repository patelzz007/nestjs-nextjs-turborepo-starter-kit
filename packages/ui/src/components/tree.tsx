"use client";

// Ported from ReUI (https://reui.io/r/base-vega/tree.json). Parts, props and
// `data-*` attributes match ReUI, so its docs and examples apply, with these
// deliberate deviations:
// - Fully typed against `@headless-tree/core` (`TreeInstance<T>` /
//   `ItemInstance<T>`) instead of `any`; contexts hold only what the parts
//   read (the indent, the toggle icon, the drag-line getter and the current
//   item's label facts), so no generic value is cast out of React context.
// - Optional headless-tree features are detected with the instance's own
//   `in` check (its proxy throws when a method's feature is not loaded), so
//   drag-and-drop and search states only appear when those features are on.
// - Indentation is an inline `padding-inline-start` (no `--tree-*` custom
//   properties, which would need a cast to fit `CSSProperties`).
// - The search-match highlight uses the `info-soft` token, not `blue-50`.
// - A part used outside its parent throws, like the kit's other compound
//   components, instead of warning and rendering nothing.
// - The caller's props are merged after headless-tree's, so its plain values
//   (e.g. `aria-label`) win; event handlers from both are chained.
// - Every part forwards its ref. The generic parts (`Tree`, `TreeItem`,
//   `TreeItemLabel`) take `ref` as a regular prop (React 19), because
//   `forwardRef` erases their item type `T`.
import type { ItemInstance, TreeInstance } from "@headless-tree/core";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronDownIcon, MinusIcon, PlusIcon } from "lucide-react";
import * as React from "react";

export type TreeToggleIconType = "chevron" | "plus-minus";

/** Pixels each nesting level is indented by, unless the root or an item overrides it. */
const DEFAULT_TREE_INDENT_PX = 20;

interface TreeContextValue {
	readonly indent: number;
	readonly toggleIconType: TreeToggleIconType;
	/** The drag-and-drop line's position, or `null` without the drag-and-drop feature. */
	readonly getDragLineStyle: (() => React.CSSProperties) | null;
}

interface TreeItemContextValue {
	readonly name: string;
	readonly isFolder: boolean;
	readonly isExpanded: boolean;
}

const TreeContext = React.createContext<TreeContextValue | null>(null);
const TreeItemContext = React.createContext<TreeItemContextValue | null>(null);

function useTreeContext(): TreeContextValue {
	const context = React.useContext(TreeContext);
	if (context === null) {
		throw new Error("Tree parts must be used within a Tree");
	}
	return context;
}

/** The enclosing item's label facts; a label with neither an item nor a parent `TreeItem` is a usage error. */
function requireItemFacts(context: TreeItemContextValue | null): TreeItemContextValue {
	if (context === null) {
		throw new Error("TreeItemLabel must be used within a TreeItem or be given an item");
	}
	return context;
}

/** Whether an optional feature's flag is on: `false` when the feature is not loaded. */
function featureFlag(isLoaded: boolean, read: () => boolean): boolean {
	return isLoaded && read();
}

interface TreeProps<T> extends Omit<React.ComponentProps<"div">, "ref"> {
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
	/** The headless-tree instance (`useTree` from `@headless-tree/react`). */
	readonly tree: TreeInstance<T>;
	/** Pixels per nesting level. */
	readonly indent?: number | undefined;
	readonly toggleIconType?: TreeToggleIconType | undefined;
}

/** The tree's container; renders whatever items the caller maps from `tree.getItems()`. */
function Tree<T>({ ref, tree, indent = DEFAULT_TREE_INDENT_PX, toggleIconType = "chevron", className, ...props }: TreeProps<T>): React.JSX.Element {
	const hasDragAndDrop = "getDragLineStyle" in tree;

	const getDragLineStyle = React.useCallback((): React.CSSProperties => tree.getDragLineStyle(), [tree]);

	const contextValue = React.useMemo<TreeContextValue>(
		() => ({ indent, toggleIconType, getDragLineStyle: hasDragAndDrop ? getDragLineStyle : null }),
		[getDragLineStyle, hasDragAndDrop, indent, toggleIconType],
	);

	const element = useRender({
		ref,
		defaultTagName: "div",
		props: mergeProps<"div">({ className: cn("flex flex-col", className) }, tree.getContainerProps(), props),
		state: { slot: "tree" },
	});

	return <TreeContext.Provider value={contextValue}>{element}</TreeContext.Provider>;
}

interface TreeItemProps<T> extends Omit<useRender.ComponentProps<"button">, "indent" | "ref"> {
	readonly ref?: React.Ref<HTMLButtonElement> | undefined;
	readonly item: ItemInstance<T>;
	/** Pixels per nesting level for this item, overriding the root's. */
	readonly indent?: number | undefined;
}

/** One node; its props (role, focus, click/keyboard handling) come from headless-tree. */
function TreeItem<T>({ ref, item, indent, className, render, children, style, ...props }: TreeItemProps<T>): React.ReactElement {
	const tree = useTreeContext();
	const level = item.getItemMeta().level;
	const isFolder = item.isFolder();
	const isExpanded = item.isExpanded();
	const name = item.getItemName();

	const itemContext = React.useMemo<TreeItemContextValue>(() => ({ name, isFolder, isExpanded }), [isExpanded, isFolder, name]);

	const element = useRender({
		ref,
		defaultTagName: "button",
		render,
		props: mergeProps<"button">(
			{
				style: { ...style, paddingInlineStart: `${String(level * (indent ?? tree.indent))}px` },
				className: cn("z-10 outline-hidden select-none not-last:pb-0.5 focus:z-20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
				"aria-expanded": isExpanded,
				children,
			},
			item.getProps(),
			props,
		),
		state: {
			slot: "tree-item",
			focus: featureFlag("isFocused" in item, () => item.isFocused()),
			folder: isFolder,
			selected: featureFlag("isSelected" in item, () => item.isSelected()),
			"drag-target": featureFlag("isDragTarget" in item, () => item.isDragTarget()),
			"search-match": featureFlag("isMatchingSearch" in item, () => item.isMatchingSearch()),
		},
	});

	return <TreeItemContext.Provider value={itemContext}>{element}</TreeItemContext.Provider>;
}

interface TreeToggleIconProps {
	readonly type: TreeToggleIconType;
	readonly isExpanded: boolean;
}

function TreeToggleIcon({ type, isExpanded }: TreeToggleIconProps): React.JSX.Element {
	if (type === "chevron") {
		return <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground in-aria-[expanded=false]:-rotate-90" />;
	}
	const Icon = isExpanded ? MinusIcon : PlusIcon;
	return <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" strokeWidth={1} />;
}

interface TreeItemLabelProps<T> extends Omit<React.ComponentProps<"span">, "ref"> {
	readonly ref?: React.Ref<HTMLSpanElement> | undefined;
	/** The item to label; defaults to the enclosing `TreeItem`'s. */
	readonly item?: ItemInstance<T> | undefined;
}

/** The label row: the toggle icon for folders, then `children` or the item's name. */
function TreeItemLabel<T>({ ref, item, children, className, ...props }: TreeItemLabelProps<T>): React.JSX.Element {
	const { toggleIconType } = useTreeContext();
	const enclosing = React.useContext(TreeItemContext);
	const facts = item === undefined ? requireItemFacts(enclosing) : { name: item.getItemName(), isFolder: item.isFolder(), isExpanded: item.isExpanded() };

	return (
		<span
			ref={ref}
			data-slot="tree-item-label"
			className={cn(
				"flex items-center gap-1 rounded-sm bg-background px-2 py-1.5 text-sm transition-colors not-in-data-[folder=true]:ps-7 hover:bg-accent in-focus-visible:ring-[3px] in-focus-visible:ring-ring/50 in-data-[drag-target=true]:bg-accent in-data-[search-match=true]:bg-info-soft! in-data-[selected=true]:bg-accent in-data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}>
			{facts.isFolder ? <TreeToggleIcon type={toggleIconType} isExpanded={facts.isExpanded} /> : null}
			{children ?? facts.name}
		</span>
	);
}

const TreeDragLine = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function TreeDragLine({ className, style, ...props }, ref): React.JSX.Element | null {
	const { getDragLineStyle } = useTreeContext();
	if (getDragLineStyle === null) {
		return null;
	}

	return (
		<div
			ref={ref}
			style={{ ...style, ...getDragLineStyle() }}
			className={cn(
				"absolute z-30 -mt-px h-0.5 w-[unset] bg-primary before:absolute before:-top-0.75 before:left-0 before:size-2 before:rounded-full before:border-2 before:border-primary before:bg-background",
				className,
			)}
			{...props}
		/>
	);
});

export { Tree, TreeItem, TreeItemLabel, TreeDragLine, type TreeProps, type TreeItemProps, type TreeItemLabelProps };
