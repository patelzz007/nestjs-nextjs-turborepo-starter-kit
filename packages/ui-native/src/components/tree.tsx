// A tree of nested items (the web kit's `Tree`): an outline, a file explorer,
// an org chart, a permissions list. Branches open and close in place behind a
// chevron or a plus and minus; guide lines can run down each indent step; a
// branch's glyph can change when it opens (a closed and an open folder). Rows
// can be picked (`selected`), or ticked with checkboxes that cascade — ticking
// a branch ticks every leaf under it, and a partly ticked branch shows a dash.
//
// Data-agnostic: `items` in. Controlled: the open branches are `expanded`
// (with `onExpandedChange`), else the tree's own display state starting from
// `defaultExpanded`; the picked row and the ticked leaves are the caller's.
// The ref reaches the root view.

import { cva } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import MinusIcon from "lucide-react-native/icons/minus";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import {
	buildCascaderIndex,
	type CascaderCheckState,
	cascaderCheckStateOf,
	type CascaderIndex,
	type CascaderNode,
	toggleCascaderCascade,
	toggleCascaderValue,
} from "../lib/cascader";
import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export interface TreeNode {
	readonly value: string;
	readonly label: string;
	/** A second line under the label (a job title). */
	readonly description?: string | undefined;
	/** The row's glyph. */
	readonly icon?: LucideIcon | undefined;
	/** A branch's glyph while open (an open folder). */
	readonly openIcon?: LucideIcon | undefined;
	/** The glyph's colour class (`accent-tone-blue`); default the muted icon colour. */
	readonly iconColorClassName?: string | undefined;
	/** Before the label, in place of the glyph: an avatar. Decorative. */
	readonly leading?: React.ReactNode | undefined;
	readonly disabled?: boolean | undefined;
	readonly children?: readonly TreeNode[] | undefined;
}

export type TreeToggle = "chevron" | "plus";
export type TreeIndent = "md" | "lg";

/** A row's indent: `md` 24 pt a level, `lg` 32 pt. */
const treeIndentVariants = cva("", {
	variants: {
		indent: { md: "", lg: "" },
		depth: { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "" },
	},
	compoundVariants: [
		{ indent: "md", depth: 1, className: "pl-6" },
		{ indent: "md", depth: 2, className: "pl-12" },
		{ indent: "md", depth: 3, className: "pl-18" },
		{ indent: "md", depth: 4, className: "pl-24" },
		{ indent: "md", depth: 5, className: "pl-30" },
		{ indent: "lg", depth: 1, className: "pl-8" },
		{ indent: "lg", depth: 2, className: "pl-16" },
		{ indent: "lg", depth: 3, className: "pl-24" },
		{ indent: "lg", depth: 4, className: "pl-32" },
		{ indent: "lg", depth: 5, className: "pl-40" },
	],
	defaultVariants: { indent: "md", depth: 0 },
});

/** The guide line of one indent level: centred under that level's toggle. */
const treeGuideVariants = cva("absolute top-0 bottom-0 w-px bg-border", {
	variants: {
		indent: { md: "", lg: "" },
		level: { 0: "", 1: "", 2: "", 3: "", 4: "" },
	},
	compoundVariants: [
		{ indent: "md", level: 0, className: "left-3" },
		{ indent: "md", level: 1, className: "left-9" },
		{ indent: "md", level: 2, className: "left-15" },
		{ indent: "md", level: 3, className: "left-21" },
		{ indent: "md", level: 4, className: "left-27" },
		{ indent: "lg", level: 0, className: "left-4" },
		{ indent: "lg", level: 1, className: "left-12" },
		{ indent: "lg", level: 2, className: "left-20" },
		{ indent: "lg", level: 3, className: "left-28" },
		{ indent: "lg", level: 4, className: "left-36" },
	],
	defaultVariants: { indent: "md", level: 0 },
});

export const treeRowVariants = cva("min-h-11 flex-row items-center gap-2 rounded-lg pr-2", {
	variants: {
		state: { default: "active:bg-muted", selected: "bg-surface-selected", disabled: "opacity-50" },
	},
	defaultVariants: { state: "default" },
});

const treeCheckboxVariants = cva("size-5 items-center justify-center rounded-md border", {
	variants: {
		state: { checked: "border-primary bg-primary", partial: "border-primary bg-primary", none: "border-input bg-card" },
	},
	defaultVariants: { state: "none" },
});

type Depth = 0 | 1 | 2 | 3 | 4 | 5;
type Level = 0 | 1 | 2 | 3 | 4;
const DEPTHS: readonly Depth[] = [0, 1, 2, 3, 4, 5];
const LEVELS: readonly Level[] = [0, 1, 2, 3, 4];
const NO_VALUES: readonly string[] = [];

function depthOf(depth: number): Depth {
	return DEPTHS.at(Math.min(depth, DEPTHS.length - 1)) ?? 0;
}

/** As cascader nodes: the tree shares the cascader's index and cascading ticks. */
function asCascaderNodes(items: readonly TreeNode[]): readonly CascaderNode[] {
	return items.map((item: TreeNode): CascaderNode => ({
		value: item.value,
		label: item.label,
		disabled: item.disabled,
		children: item.children === undefined ? undefined : asCascaderNodes(item.children),
	}));
}

interface VisibleRow {
	readonly node: TreeNode;
	readonly depth: number;
}

/** The rows on screen: every top item, and the children of each open branch under it. */
export function visibleTreeRows(items: readonly TreeNode[], expanded: readonly string[], depth = 0): readonly VisibleRow[] {
	return items.flatMap((node: TreeNode): readonly VisibleRow[] => [
		{ node, depth },
		...(node.children !== undefined && expanded.includes(node.value) ? visibleTreeRows(node.children, expanded, depth + 1) : []),
	]);
}

export interface TreeProps {
	readonly items: readonly TreeNode[];
	/** The open branches: the caller's, with `onExpandedChange`. */
	readonly expanded?: readonly string[] | undefined;
	readonly onExpandedChange?: ((expanded: readonly string[]) => void) | undefined;
	/** The branches open at first, when the tree keeps them itself. */
	readonly defaultExpanded?: readonly string[] | undefined;
	/** The picked row. */
	readonly selected?: string | null | undefined;
	/** A row was pressed (branches also open or close). */
	readonly onSelect?: ((value: string) => void) | undefined;
	/** The ticked leaves: shows a checkbox on every row. */
	readonly checked?: readonly string[] | undefined;
	readonly onCheckedChange?: ((checked: readonly string[]) => void) | undefined;
	readonly toggle?: TreeToggle | undefined;
	/** Guide lines down each indent level. */
	readonly guides?: boolean | undefined;
	readonly indent?: TreeIndent | undefined;
	/** The tree's name for screen readers. */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface TreeRowProps {
	readonly row: VisibleRow;
	readonly open: boolean;
	readonly selected: boolean;
	readonly check: CascaderCheckState | null;
	readonly toggle: TreeToggle;
	readonly guides: boolean;
	readonly indent: TreeIndent;
	readonly onToggle: (value: string) => void;
	readonly onSelect: (value: string) => void;
	readonly onCheck: (value: string) => void;
}

const TreeRow = React.memo(function TreeRow({ row, open, selected, check, toggle, guides, indent, onToggle, onSelect, onCheck }: TreeRowProps): React.JSX.Element {
	const { node, depth } = row;
	const branch = node.children !== undefined;
	const press = React.useCallback((): void => {
		if (branch) {
			onToggle(node.value);
		}
		onSelect(node.value);
	}, [branch, node.value, onSelect, onToggle]);
	const tick = React.useCallback((): void => {
		onCheck(node.value);
	}, [node.value, onCheck]);
	const disabled = node.disabled === true;
	const accessibilityState = React.useMemo(() => ({ expanded: branch ? open : undefined, selected, disabled }), [branch, disabled, open, selected]);
	const ticked: boolean | "mixed" = check === "partial" ? "mixed" : check === "checked";
	const checkState = React.useMemo(() => ({ checked: ticked, disabled }), [disabled, ticked]);
	const glyph = open && node.openIcon !== undefined ? node.openIcon : node.icon;
	const toggleGlyph = toggle === "plus" ? (open ? MinusIcon : PlusIcon) : open ? ChevronDownIcon : ChevronRightIcon;
	return (
		<View className="flex-row items-center">
			{guides
				? LEVELS.slice(0, depth).map((level: Level): React.JSX.Element => <View key={level} importantForAccessibility="no" className={treeGuideVariants({ indent, level })} />)
				: null}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={node.description === undefined ? node.label : `${node.label}, ${node.description}`}
				accessibilityState={accessibilityState}
				disabled={disabled}
				onPress={press}
				className={cn("flex-1", treeIndentVariants({ indent, depth: depthOf(depth) }), treeRowVariants({ state: disabled ? "disabled" : selected ? "selected" : "default" }))}>
				<View className="size-6 items-center justify-center">{branch ? <Icon icon={toggleGlyph} size="sm" colorClassName="accent-icon" /> : null}</View>
				{node.leading ?? (glyph === undefined ? null : <Icon icon={glyph} size="sm" colorClassName={node.iconColorClassName ?? "accent-muted-foreground"} />)}
				<View className="flex-1">
					<Text numberOfLines={1} className="text-body font-sans text-foreground">
						{node.label}
					</Text>
					{node.description === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{node.description}</Text>}
				</View>
			</Pressable>
			{check === null ? null : (
				<Pressable
					accessibilityRole="checkbox"
					accessibilityLabel={`Allow ${node.label}`}
					accessibilityState={checkState}
					disabled={disabled}
					onPress={tick}
					className="size-11 items-center justify-center">
					<View className={treeCheckboxVariants({ state: check })}>
						{check === "none" ? null : <Icon icon={check === "partial" ? MinusIcon : CheckIcon} size="xs" colorClassName="accent-primary-foreground" />}
					</View>
				</Pressable>
			)}
		</View>
	);
});

function checkOf(index: CascaderIndex, node: TreeNode, checked: readonly string[] | undefined): CascaderCheckState | null {
	if (checked === undefined) {
		return null;
	}
	const cascaderNode = index.byValue.get(node.value);
	if (cascaderNode === undefined) {
		return "none";
	}
	return node.children === undefined ? (checked.includes(node.value) ? "checked" : "none") : cascaderCheckStateOf(index, cascaderNode, checked);
}

export const Tree = React.memo(
	React.forwardRef<ViewInstance, TreeProps>(function Tree(
		{
			items,
			expanded: shownExpanded,
			onExpandedChange,
			defaultExpanded = NO_VALUES,
			selected = null,
			onSelect,
			checked,
			onCheckedChange,
			toggle = "chevron",
			guides = false,
			indent = "md",
			accessibilityLabel,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const [ownExpanded, setOwnExpanded] = React.useState<readonly string[]>(defaultExpanded);
		const expanded = shownExpanded ?? ownExpanded;
		const index = React.useMemo(() => buildCascaderIndex(asCascaderNodes(items)), [items]);
		const rows = visibleTreeRows(items, expanded);
		const toggleBranch = React.useCallback(
			(value: string): void => {
				const next = toggleCascaderValue(expanded, value);
				setOwnExpanded(next);
				onExpandedChange?.(next);
			},
			[expanded, onExpandedChange],
		);
		const select = React.useCallback(
			(value: string): void => {
				onSelect?.(value);
			},
			[onSelect],
		);
		const check = React.useCallback(
			(value: string): void => {
				const node = index.byValue.get(value);
				if (checked !== undefined && node !== undefined) {
					onCheckedChange?.(toggleCascaderCascade(index, node, checked));
				}
			},
			[checked, index, onCheckedChange],
		);
		return (
			<View ref={ref} accessibilityLabel={accessibilityLabel} testID={testID} className={cn("gap-0.5", className)}>
				{rows.map((row: VisibleRow): React.JSX.Element => (
					<TreeRow
						key={row.node.value}
						row={row}
						open={expanded.includes(row.node.value)}
						selected={selected === row.node.value}
						check={checkOf(index, row.node, checked)}
						toggle={toggle}
						guides={guides}
						indent={indent}
						onToggle={toggleBranch}
						onSelect={select}
						onCheck={check}
					/>
				))}
			</View>
		);
	}),
);
