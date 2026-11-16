// A picker for a tree of options (the web kit's `Cascader`): a region, then
// a country, then a city; a team, then a member; a folder, then a file.
// `CascaderPanel` is the picker itself, for a sheet or a card: a search box,
// then the tree as levels to drill into (`drill`, the default on a phone),
// side by side columns that scroll on their own (`columns`), or one list
// with branches that open in place (`tree`). `Cascader` is a field that opens
// the panel in a bottom sheet and writes the picked path.
//
// One value or several (`multiple`, up to `max`); with `cascade`, ticking a
// branch ticks every selectable leaf under it. Which nodes can be picked is
// `selectable` (leaves, any node, or the caller's rule). Levels can load on
// demand (`getChildren`), and search looks at the shown level, everything
// under it, or the whole tree, writing each hit's path under it.
//
// Controlled: `value` in, `onChange(next, details)` out. The open level and
// the search text are the panel's own display state unless the caller owns
// them (`path` / `onPathChange`, `query` / `onQueryChange`). Every word can
// be replaced (`labels`) for another language. The ref reaches the root view.

import { cva } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import MinusIcon from "lucide-react-native/icons/minus";
import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";
import { ActivityIndicator, FlatList, type ListRenderItemInfo, Pressable, ScrollView, Text, TextInput, View, type ViewInstance } from "react-native";

import {
	buildCascaderIndex,
	CASCADER_ROOT,
	type CascaderCheckState,
	cascaderCheckStateOf,
	type CascaderCollapse,
	type CascaderIndex,
	type CascaderNode,
	cascaderPathOf,
	cascaderPathSegments,
	type CascaderSearchResult,
	type CascaderSearchScope,
	type CascaderSelectable,
	type CascaderValueDisplay,
	isCascaderBranch,
	isCascaderSelectable,
	searchCascader,
	toggleCascaderCascade,
	toggleCascaderValue,
} from "../lib/cascader";
import { cn } from "../lib/cn";
import { playSelectionFeedback } from "../lib/haptics";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { Icon } from "./icon";
import { SelectTrigger, type SelectSize, type SelectVariant } from "./select-field";
import { ErrorText, Label, MutedText } from "./text";

/* -------------------------------------------------------------------------- */
/*                                   Labels                                   */
/* -------------------------------------------------------------------------- */

/** Every word the cascader shows or says. */
export interface CascaderLabels {
	/** The search box's placeholder and name. */
	readonly search: string;
	readonly back: string;
	readonly loading: string;
	readonly error: string;
	readonly retry: string;
	readonly empty: string;
	readonly done: string;
	/** The name of the columns' scrolling row. */
	readonly columns: string;
	/** The name of the top level, in the breadcrumb. */
	readonly rootLevel: string;
	readonly pathSeparator: string;
	readonly selectedCount: (count: number) => string;
	readonly itemCount: (count: number) => string;
	/** The name of a branch's open button ("Open Europe"). */
	readonly open: (label: string) => string;
	readonly expand: (label: string) => string;
	readonly collapse: (label: string) => string;
}

export const DEFAULT_CASCADER_LABELS: CascaderLabels = {
	search: "Search",
	back: "Back",
	loading: "Loading…",
	error: "This level could not load.",
	retry: "Retry",
	empty: "No results.",
	done: "Done",
	columns: "Columns",
	rootLevel: "All",
	pathSeparator: " / ",
	selectedCount: (count: number): string => `${String(count)} selected`,
	itemCount: (count: number): string => `${String(count)} ${count === 1 ? "item" : "items"}`,
	open: (label: string): string => `Open ${label}`,
	expand: (label: string): string => `Expand ${label}`,
	collapse: (label: string): string => `Collapse ${label}`,
};

/* -------------------------------------------------------------------------- */
/*                                    Props                                   */
/* -------------------------------------------------------------------------- */

/** How the tree is laid out. */
export type CascaderMode = "drill" | "columns" | "tree";

/** Why the value changed. */
export type CascaderChangeReason = "select" | "deselect" | "clear";

export interface CascaderChangeDetails {
	readonly node: CascaderNode | null;
	readonly path: readonly CascaderNode[];
	readonly reason: CascaderChangeReason;
}

/** What a row is, for `renderLabel` and `renderTrailing`. */
export interface CascaderItemState {
	readonly selected: boolean;
	readonly checkState: CascaderCheckState;
	readonly branch: boolean;
	readonly disabled: boolean;
}

/** How tall the list is: `sm` 240 pt (a card), `md` a sheet's, `lg` a screen's. */
export type CascaderListSize = "sm" | "md" | "lg";

interface CascaderPanelBaseProps {
	readonly items: readonly CascaderNode[];
	/** Flat data: each node's parent value, or `null` / `undefined` at the top. */
	readonly getParent?: ((node: CascaderNode) => string | null | undefined) | undefined;
	/** Loads a branch's children when it is first opened (a branch marked `hasChildren`). */
	readonly getChildren?: ((node: CascaderNode) => Promise<readonly CascaderNode[]>) | undefined;
	/** Which nodes can be picked. Default `leaf`. */
	readonly selectable?: CascaderSelectable | undefined;
	readonly mode?: CascaderMode | undefined;
	/** Show the search box. Default `true`. */
	readonly searchable?: boolean | undefined;
	/** Where search looks. Default `deep` (everything under the shown level). */
	readonly searchScope?: CascaderSearchScope | undefined;
	/** The search text: the caller's, with `onQueryChange`. */
	readonly query?: string | undefined;
	readonly onQueryChange?: ((query: string) => void) | undefined;
	/** The open branches, top down: the caller's, with `onPathChange`. */
	readonly path?: readonly string[] | undefined;
	readonly onPathChange?: ((path: readonly string[]) => void) | undefined;
	/** Draws a row's label in place of the plain text (a dot, a badge, two lines). */
	readonly renderLabel?: ((node: CascaderNode, state: CascaderItemState) => React.ReactNode) | undefined;
	/** After the label: a chip, a code, a sum. */
	readonly renderTrailing?: ((node: CascaderNode, state: CascaderItemState) => React.ReactNode) | undefined;
	/** Show a branch's `count`. Default `true`. */
	readonly showCounts?: boolean | undefined;
	readonly listSize?: CascaderListSize | undefined;
	/** Above the search box. */
	readonly header?: React.ReactNode | undefined;
	/** Under the list: actions, a summary. */
	readonly footer?: React.ReactNode | undefined;
	readonly labels?: Partial<CascaderLabels> | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export interface CascaderPanelSingleProps extends CascaderPanelBaseProps {
	readonly multiple?: false | undefined;
	readonly value: string | null;
	readonly onChange: (value: string, details: CascaderChangeDetails) => void;
}

export interface CascaderPanelMultipleProps extends CascaderPanelBaseProps {
	readonly multiple: true;
	readonly value: readonly string[];
	readonly onChange: (values: readonly string[], details: CascaderChangeDetails) => void;
	/** The most values that can be picked. */
	readonly max?: number | undefined;
	/** Ticking a branch ticks every selectable leaf under it. */
	readonly cascade?: boolean | undefined;
}

export type CascaderPanelProps = CascaderPanelSingleProps | CascaderPanelMultipleProps;

/* -------------------------------------------------------------------------- */
/*                                    Rows                                    */
/* -------------------------------------------------------------------------- */

export const cascaderRowVariants = cva("min-h-12 flex-row items-center gap-3 rounded-lg px-2 py-2", {
	variants: {
		state: {
			default: "active:bg-muted",
			selected: "bg-surface-selected",
			disabled: "opacity-50",
		},
	},
	defaultVariants: { state: "default" },
});

/** A row's indent in tree mode, by depth. */
const cascaderIndentVariants = cva("", {
	variants: {
		depth: { 0: "", 1: "pl-6", 2: "pl-12", 3: "pl-16", 4: "pl-20" },
	},
	defaultVariants: { depth: 0 },
});

type IndentDepth = 0 | 1 | 2 | 3 | 4;
const MAX_INDENT: IndentDepth = 4;
const INDENTS: readonly IndentDepth[] = [0, 1, 2, 3, 4];

function indentOf(depth: number): IndentDepth {
	return INDENTS.at(Math.min(depth, MAX_INDENT)) ?? MAX_INDENT;
}

export const cascaderCheckboxVariants = cva("size-5 items-center justify-center rounded-md border", {
	variants: {
		state: {
			checked: "border-primary bg-primary",
			partial: "border-primary bg-primary",
			none: "border-input bg-card",
		},
	},
	defaultVariants: { state: "none" },
});

const cascaderListVariants = cva("", {
	variants: {
		size: { sm: "h-60", md: "h-80", lg: "h-112" },
	},
	defaultVariants: { size: "md" },
});

interface RowAction {
	/** The row's own tap: pick, tick, or open. */
	readonly onPress: (node: CascaderNode) => void;
	/** A separate open button, when the row's tap picks. */
	readonly onOpen: ((node: CascaderNode) => void) | undefined;
}

interface CascaderRowProps {
	readonly node: CascaderNode;
	readonly state: CascaderItemState;
	readonly multiple: boolean;
	/** The row's tap picks or ticks (else it opens). */
	readonly picks: boolean;
	readonly action: RowAction;
	/** The path to a search hit, under its label. */
	readonly annotation: string | undefined;
	readonly depth: number;
	/** Tree mode: the branch is open. */
	readonly expanded: boolean | undefined;
	readonly showCount: boolean;
	readonly labels: CascaderLabels;
	readonly renderLabel: CascaderPanelBaseProps["renderLabel"];
	readonly renderTrailing: CascaderPanelBaseProps["renderTrailing"];
}

const CascaderRow = React.memo(function CascaderRow({
	node,
	state,
	multiple,
	picks,
	action,
	annotation,
	depth,
	expanded,
	showCount,
	labels,
	renderLabel,
	renderTrailing,
}: CascaderRowProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		action.onPress(node);
	}, [action, node]);
	const open = React.useCallback((): void => {
		action.onOpen?.(node);
	}, [action, node]);
	const role = picks ? (multiple ? "checkbox" : "radio") : "button";
	const checked: boolean | "mixed" | undefined = picks ? (state.checkState === "partial" ? "mixed" : state.selected) : undefined;
	const accessibilityState = React.useMemo(() => ({ checked, disabled: state.disabled, expanded }), [checked, expanded, state.disabled]);
	const description = annotation ?? node.description;
	const rowState = state.disabled ? "disabled" : state.selected && !multiple ? "selected" : "default";
	return (
		<View className={cn("flex-row items-center", cascaderIndentVariants({ depth: indentOf(depth) }))}>
			<Pressable
				accessibilityRole={role}
				accessibilityLabel={node.label}
				accessibilityHint={description}
				accessibilityState={accessibilityState}
				disabled={state.disabled}
				onPress={press}
				className={cn("flex-1", cascaderRowVariants({ state: rowState }))}>
				{multiple && picks ? (
					<View className={cascaderCheckboxVariants({ state: state.checkState })}>
						{state.checkState === "none" ? null : <Icon icon={state.checkState === "partial" ? MinusIcon : CheckIcon} size="xs" colorClassName="accent-primary-foreground" />}
					</View>
				) : null}
				{node.icon === undefined ? null : <View importantForAccessibility="no-hide-descendants">{node.icon}</View>}
				<View className="flex-1 gap-0.5">
					{renderLabel === undefined ? <Text className="text-body-lg font-sans text-foreground">{node.label}</Text> : renderLabel(node, state)}
					{description === undefined ? null : (
						<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
							{description}
						</Text>
					)}
				</View>
				{renderTrailing === undefined ? null : <View importantForAccessibility="no-hide-descendants">{renderTrailing(node, state)}</View>}
				{showCount && node.count !== undefined ? (
					<Text accessibilityLabel={labels.itemCount(node.count)} className="text-caption font-sans text-muted-foreground tabular-nums">
						{String(node.count)}
					</Text>
				) : null}
				{!multiple && state.selected ? <Icon icon={CheckIcon} size="md" colorClassName="accent-primary" /> : null}
				{state.branch && !picks && expanded === undefined ? <Icon icon={ChevronRightIcon} size="sm" colorClassName="accent-icon" /> : null}
			</Pressable>
			{state.branch && (picks || expanded !== undefined) ? <OpenButton label={openLabelOf(labels, node.label, expanded)} expanded={expanded} onPress={open} /> : null}
		</View>
	);
});

function openLabelOf(labels: CascaderLabels, label: string, expanded: boolean | undefined): string {
	if (expanded === undefined) {
		return labels.open(label);
	}
	return expanded ? labels.collapse(label) : labels.expand(label);
}

interface OpenButtonProps {
	readonly label: string;
	readonly expanded: boolean | undefined;
	readonly onPress: () => void;
}

function OpenButton({ label, expanded, onPress }: OpenButtonProps): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ expanded }), [expanded]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			onPress={onPress}
			className="size-11 items-center justify-center rounded-full active:bg-muted">
			<Icon icon={expanded === true ? ChevronDownIcon : ChevronRightIcon} size="sm" colorClassName="accent-icon" />
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */
/*                                    Panel                                   */
/* -------------------------------------------------------------------------- */

type ListRow =
	| { readonly kind: "heading"; readonly key: string; readonly label: string }
	| { readonly kind: "node"; readonly key: string; readonly node: CascaderNode; readonly depth: number; readonly annotation: string | undefined };

/** A level's nodes as list rows, each group under its heading. */
function levelRowsOf(nodes: readonly CascaderNode[], depth: number): readonly ListRow[] {
	const rows: ListRow[] = [];
	let group: string | undefined;
	nodes.forEach((node: CascaderNode): void => {
		if (node.group !== undefined && node.group !== group) {
			rows.push({ kind: "heading", key: `group:${node.group}:${node.value}`, label: node.group });
		}
		group = node.group;
		rows.push({ kind: "node", key: node.value, node, depth, annotation: undefined });
	});
	return rows;
}

/** The tree mode's rows: every root, and the children of each open branch under it. */
function treeRowsOf(index: CascaderIndex, expanded: ReadonlySet<string>, parent: string, depth: number): readonly ListRow[] {
	return levelRowsOf(index.childrenOf.get(parent) ?? [], depth).flatMap((row: ListRow): readonly ListRow[] =>
		row.kind === "node" && expanded.has(row.node.value) ? [row, ...treeRowsOf(index, expanded, row.node.value, depth + 1)] : [row],
	);
}

interface LoadState {
	readonly loaded: ReadonlyMap<string, readonly CascaderNode[]>;
	readonly loading: ReadonlySet<string>;
	readonly failed: ReadonlySet<string>;
}

const NO_LOADS: LoadState = { loaded: new Map(), loading: new Set(), failed: new Set() };
const NO_PATH: readonly string[] = [];

/** Loads branches on demand: what has loaded, what is loading, what failed. */
function useCascaderLoads(getChildren: CascaderPanelBaseProps["getChildren"]): { readonly state: LoadState; readonly load: (node: CascaderNode) => void } {
	const [state, setState] = React.useState<LoadState>(NO_LOADS);
	const load = React.useCallback(
		(node: CascaderNode): void => {
			if (getChildren === undefined) {
				return;
			}
			setState((current: LoadState): LoadState => ({ ...current, loading: new Set([...current.loading, node.value]), failed: without(current.failed, node.value) }));
			getChildren(node)
				.then((children: readonly CascaderNode[]): void => {
					setState((current: LoadState): LoadState => ({
						loaded: new Map([...current.loaded, [node.value, children]]),
						loading: without(current.loading, node.value),
						failed: current.failed,
					}));
				})
				.catch((): void => {
					setState((current: LoadState): LoadState => ({ ...current, loading: without(current.loading, node.value), failed: new Set([...current.failed, node.value]) }));
				});
		},
		[getChildren],
	);
	return { state, load };
}

function without(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
	return new Set([...set].filter((entry: string): boolean => entry !== value));
}

/** The panel's view of a node: picked, ticked, a branch, ruled out. */
function itemStateOf(props: CascaderPanelProps, index: CascaderIndex, node: CascaderNode, selectable: CascaderSelectable): CascaderItemState {
	const branch = isCascaderBranch(index, node);
	if (props.multiple === true) {
		const cascading = props.cascade === true && branch;
		const checkState = cascading ? cascaderCheckStateOf(index, node, props.value) : props.value.includes(node.value) ? "checked" : "none";
		const atMax = props.max !== undefined && props.value.length >= props.max && checkState === "none";
		const disabled = node.disabled === true || (!cascading && !isCascaderSelectable(index, node, selectable) && !branch) || atMax;
		return { selected: checkState === "checked", checkState, branch, disabled };
	}
	const selected = props.value === node.value;
	return { selected, checkState: selected ? "checked" : "none", branch, disabled: node.disabled === true };
}

/** Whether the row's tap picks (else it opens the branch). */
function picksOnPress(props: CascaderPanelProps, index: CascaderIndex, node: CascaderNode, selectable: CascaderSelectable): boolean {
	if (props.multiple === true && props.cascade === true) {
		return true;
	}
	return isCascaderSelectable(index, node, selectable);
}

export const CascaderPanel = React.memo(
	React.forwardRef<ViewInstance, CascaderPanelProps>(function CascaderPanel(props, ref): React.JSX.Element {
		const {
			items,
			getParent,
			getChildren,
			selectable = "leaf",
			mode = "drill",
			searchable = true,
			searchScope = "deep",
			query: shownQuery,
			onQueryChange,
			path: shownPath,
			onPathChange,
			renderLabel,
			renderTrailing,
			showCounts = true,
			listSize = "md",
			header,
			footer,
			labels: labelOverrides,
			className,
			testID,
		} = props;
		const labels = React.useMemo((): CascaderLabels => ({ ...DEFAULT_CASCADER_LABELS, ...labelOverrides }), [labelOverrides]);
		const [ownQuery, setOwnQuery] = React.useState("");
		const [ownPath, setOwnPath] = React.useState<readonly string[]>(NO_PATH);
		const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => new Set<string>());
		const { state: loads, load } = useCascaderLoads(getChildren);
		const query = shownQuery ?? ownQuery;
		const path = shownPath ?? ownPath;
		const index = React.useMemo(() => buildCascaderIndex(items, { getParent, loaded: loads.loaded }), [getParent, items, loads.loaded]);
		const parent = path.at(-1) ?? CASCADER_ROOT;
		const parentNode = index.byValue.get(parent);
		const searching = query.trim().length > 0;

		const changeQuery = React.useCallback(
			(next: string): void => {
				setOwnQuery(next);
				onQueryChange?.(next);
			},
			[onQueryChange],
		);
		const changePath = React.useCallback(
			(next: readonly string[]): void => {
				setOwnPath(next);
				onPathChange?.(next);
			},
			[onPathChange],
		);
		const needsLoad = React.useCallback(
			(node: CascaderNode): boolean => node.hasChildren === true && !loads.loaded.has(node.value) && (index.childrenOf.get(node.value)?.length ?? 0) === 0,
			[index.childrenOf, loads.loaded],
		);
		const open = React.useCallback(
			(node: CascaderNode): void => {
				if (needsLoad(node) && !loads.loading.has(node.value)) {
					load(node);
				}
				if (mode === "tree") {
					setExpanded((current: ReadonlySet<string>): ReadonlySet<string> => (current.has(node.value) ? without(current, node.value) : new Set([...current, node.value])));
					return;
				}
				const nodePath = cascaderPathOf(index, node.value).map((step: CascaderNode): string => step.value);
				changePath(nodePath);
				changeQuery("");
			},
			[changePath, changeQuery, index, load, loads.loading, mode, needsLoad],
		);
		const pick = React.useCallback(
			(node: CascaderNode): void => {
				playSelectionFeedback();
				const nodePath = cascaderPathOf(index, node.value);
				if (props.multiple === true) {
					const next =
						props.cascade === true && isCascaderBranch(index, node)
							? toggleCascaderCascade(index, node, props.value, props.max)
							: toggleCascaderValue(props.value, node.value, props.max);
					props.onChange(next, { node, path: nodePath, reason: next.length < props.value.length ? "deselect" : "select" });
					return;
				}
				props.onChange(node.value, { node, path: nodePath, reason: "select" });
			},
			[index, props],
		);
		const press = React.useCallback(
			(node: CascaderNode): void => {
				if (picksOnPress(props, index, node, selectable)) {
					pick(node);
					return;
				}
				if (isCascaderBranch(index, node)) {
					open(node);
				}
			},
			[index, open, pick, props, selectable],
		);
		const action = React.useMemo((): RowAction => ({ onPress: press, onOpen: open }), [open, press]);
		const back = React.useCallback((): void => {
			changePath(path.slice(0, -1));
		}, [changePath, path]);
		const retry = React.useCallback((): void => {
			if (parentNode !== undefined) {
				load(parentNode);
			}
		}, [load, parentNode]);

		const rows = React.useMemo((): readonly ListRow[] => {
			if (searching) {
				const scopeParent = mode === "tree" ? CASCADER_ROOT : parent;
				return searchCascader(index, query, searchScope, scopeParent).map((result: CascaderSearchResult): ListRow => ({
					kind: "node",
					key: result.node.value,
					node: result.node,
					depth: 0,
					annotation:
						result.path.length > 1
							? result.path
									.slice(0, -1)
									.map((step: CascaderNode): string => step.label)
									.join(labels.pathSeparator)
							: undefined,
				}));
			}
			if (mode === "tree") {
				return treeRowsOf(index, expanded, CASCADER_ROOT, 0);
			}
			return levelRowsOf(index.childrenOf.get(parent) ?? [], 0);
		}, [expanded, index, labels.pathSeparator, mode, parent, query, searchScope, searching]);

		const renderRow = React.useCallback(
			({ item }: ListRenderItemInfo<ListRow>): React.JSX.Element => {
				if (item.kind === "heading") {
					return (
						<Text accessibilityRole="header" className="font-sans-medium text-caption pt-3 pb-1 text-muted-foreground">
							{item.label}
						</Text>
					);
				}
				const state = itemStateOf(props, index, item.node, selectable);
				const isTree = mode === "tree" && !searching;
				return (
					<CascaderRow
						node={item.node}
						state={state}
						multiple={props.multiple === true}
						picks={picksOnPress(props, index, item.node, selectable)}
						action={action}
						annotation={item.annotation}
						depth={item.depth}
						expanded={isTree && state.branch ? expanded.has(item.node.value) : undefined}
						showCount={showCounts}
						labels={labels}
						renderLabel={renderLabel}
						renderTrailing={renderTrailing}
					/>
				);
			},
			[action, expanded, index, labels, mode, props, renderLabel, renderTrailing, searching, selectable, showCounts],
		);
		const keyOf = React.useCallback((row: ListRow): string => row.key, []);
		const levelLoading = parentNode !== undefined && loads.loading.has(parentNode.value);
		const levelFailed = parentNode !== undefined && loads.failed.has(parentNode.value);
		const showsBreadcrumb = mode === "drill" && path.length > 0 && !searching;

		return (
			<View ref={ref} testID={testID} className={cn("gap-2", className)}>
				{header}
				{searchable ? (
					<View className="rounded-button min-h-11 flex-row items-center gap-2 border border-input bg-popover px-3">
						<Icon icon={SearchIcon} size="sm" colorClassName="accent-muted-foreground" />
						<TextInput
							accessibilityLabel={labels.search}
							value={query}
							onChangeText={changeQuery}
							placeholder={labels.search}
							placeholderTextColorClassName="accent-muted-foreground"
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="search"
							className="text-body-lg flex-1 py-2.5 font-sans text-foreground"
						/>
					</View>
				) : null}
				{showsBreadcrumb ? <CascaderBreadcrumb index={index} path={path} labels={labels} onBack={back} /> : null}
				{mode === "columns" && !searching ? (
					<CascaderColumns
						index={index}
						path={path}
						props={props}
						selectable={selectable}
						action={action}
						labels={labels}
						showCounts={showCounts}
						listSize={listSize}
						renderLabel={renderLabel}
						renderTrailing={renderTrailing}
					/>
				) : (
					<View className={cascaderListVariants({ size: listSize })}>
						<LevelStatus loading={levelLoading} failed={levelFailed} labels={labels} onRetry={retry}>
							<FlatList
								data={rows}
								keyExtractor={keyOf}
								renderItem={renderRow}
								keyboardShouldPersistTaps="handled"
								ListEmptyComponent={<MutedText className="py-6 text-center">{labels.empty}</MutedText>}
							/>
						</LevelStatus>
					</View>
				)}
				{footer}
			</View>
		);
	}),
);

interface LevelStatusProps {
	readonly loading: boolean;
	readonly failed: boolean;
	readonly labels: CascaderLabels;
	readonly onRetry: () => void;
	readonly children: React.ReactNode;
}

/** A level that is loading, failed to load (with Retry), or ready. */
function LevelStatus({ loading, failed, labels, onRetry, children }: LevelStatusProps): React.ReactNode {
	if (loading) {
		return (
			<View accessibilityLabel={labels.loading} className="flex-1 items-center justify-center gap-2">
				<ActivityIndicator colorClassName="accent-muted-foreground" />
				<MutedText>{labels.loading}</MutedText>
			</View>
		);
	}
	if (failed) {
		return (
			<View className="flex-1 items-center justify-center gap-3">
				<ErrorText accessibilityRole="alert">{labels.error}</ErrorText>
				<Button label={labels.retry} variant="outline" size="sm" onPress={onRetry} />
			</View>
		);
	}
	return children;
}

interface CascaderBreadcrumbProps {
	readonly index: CascaderIndex;
	readonly path: readonly string[];
	readonly labels: CascaderLabels;
	readonly onBack: () => void;
}

/** The open level's way back, and where it is. */
function CascaderBreadcrumb({ index, path, labels, onBack }: CascaderBreadcrumbProps): React.JSX.Element {
	const names = [labels.rootLevel, ...path.map((value: string): string => index.byValue.get(value)?.label ?? value)];
	return (
		<View className="flex-row items-center gap-1">
			<Pressable accessibilityRole="button" accessibilityLabel={labels.back} onPress={onBack} className="size-11 items-center justify-center rounded-full active:bg-muted">
				<Icon icon={ChevronLeftIcon} size="md" colorClassName="accent-foreground" />
			</Pressable>
			<Text accessibilityRole="header" numberOfLines={1} className="text-body font-sans-medium flex-1 text-foreground">
				{cascaderPathSegments(names, "start", DEFAULT_BREADCRUMB_SEGMENTS).join(labels.pathSeparator)}
			</Text>
		</View>
	);
}

/** How many parts the breadcrumb shows before it shortens. */
const DEFAULT_BREADCRUMB_SEGMENTS = 3;

interface CascaderColumnsProps {
	readonly index: CascaderIndex;
	readonly path: readonly string[];
	readonly props: CascaderPanelProps;
	readonly selectable: CascaderSelectable;
	readonly action: RowAction;
	readonly labels: CascaderLabels;
	readonly showCounts: boolean;
	readonly listSize: CascaderListSize;
	readonly renderLabel: CascaderPanelBaseProps["renderLabel"];
	readonly renderTrailing: CascaderPanelBaseProps["renderTrailing"];
}

/** Columns mode: one scrolling column per open level, side by side, the row that opened the next one tinted. */
function CascaderColumns({ index, path, props, selectable, action, labels, showCounts, listSize, renderLabel, renderTrailing }: CascaderColumnsProps): React.JSX.Element {
	const levels = [CASCADER_ROOT, ...path];
	return (
		<ScrollView horizontal accessibilityLabel={labels.columns} contentContainerClassName="gap-2" className={cascaderListVariants({ size: listSize })}>
			{levels.map((parent: string): React.JSX.Element => {
				const nodes = index.childrenOf.get(parent) ?? [];
				return (
					<ScrollView key={parent === CASCADER_ROOT ? "root" : parent} className="w-60 rounded-lg border border-border">
						{nodes.map((node: CascaderNode): React.JSX.Element => {
							const state = itemStateOf(props, index, node, selectable);
							const isOpen = path.includes(node.value);
							return (
								<View key={node.value} className={cn(isOpen ? "bg-muted" : undefined)}>
									<CascaderRow
										node={node}
										state={state}
										multiple={props.multiple === true}
										picks={picksOnPress(props, index, node, selectable)}
										action={action}
										annotation={undefined}
										depth={0}
										expanded={undefined}
										showCount={showCounts}
										labels={labels}
										renderLabel={renderLabel}
										renderTrailing={renderTrailing}
									/>
								</View>
							);
						})}
					</ScrollView>
				);
			})}
		</ScrollView>
	);
}

/* -------------------------------------------------------------------------- */
/*                                    Field                                   */
/* -------------------------------------------------------------------------- */

interface CascaderFieldOptions {
	/** The field's label, and the sheet's title. */
	readonly label: string;
	readonly hideLabel?: boolean | undefined;
	readonly placeholder?: string | undefined;
	readonly hint?: string | undefined;
	readonly error?: string | undefined;
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** How a picked path is written. Default `path` (one value) or `count` (several). */
	readonly display?: CascaderValueDisplay | undefined;
	/** Where a long path is shortened. Default `middle`. */
	readonly collapse?: CascaderCollapse | undefined;
	/** The most parts written before the path is shortened. Default 3. */
	readonly maxSegments?: number | undefined;
	/** Draws the picked paths in the field in place of their text; the field's name still reads the text. */
	readonly renderValue?: ((paths: readonly (readonly CascaderNode[])[]) => React.ReactNode) | undefined;
	/** Shows a clear button while something is picked. */
	readonly onClear?: (() => void) | undefined;
	/** Close the sheet after a pick (one value). Default `true`. */
	readonly closeOnSelect?: boolean | undefined;
	readonly variant?: SelectVariant | undefined;
	readonly size?: SelectSize | undefined;
}

export type CascaderProps = (Omit<CascaderPanelSingleProps, "className" | "testID"> | Omit<CascaderPanelMultipleProps, "className" | "testID">) &
	CascaderFieldOptions & {
		/** Extra classes for the field, merged last. */
		readonly className?: string | undefined;
		/** The trigger's test ID. */
		readonly testID?: string | undefined;
	};

const DEFAULT_MAX_SEGMENTS = 3;

/** The field's text for the picked paths. */
function fieldTextOf(
	paths: readonly (readonly CascaderNode[])[],
	display: CascaderValueDisplay,
	collapse: CascaderCollapse,
	maxSegments: number,
	labels: CascaderLabels,
): string | undefined {
	const [only] = paths;
	if (only === undefined) {
		return undefined;
	}
	if (display === "count") {
		return labels.selectedCount(paths.length);
	}
	if (display === "leaf") {
		return paths.map((path: readonly CascaderNode[]): string => path.at(-1)?.label ?? "").join(", ");
	}
	return paths.length === 1 ? writePath(only, collapse, maxSegments, labels) : labels.selectedCount(paths.length);
}

function writePath(path: readonly CascaderNode[], collapse: CascaderCollapse, maxSegments: number, labels: CascaderLabels): string {
	return cascaderPathSegments(
		path.map((node: CascaderNode): string => node.label),
		collapse,
		maxSegments,
	).join(labels.pathSeparator);
}

export const Cascader = React.memo(
	React.forwardRef<ViewInstance, CascaderProps>(function Cascader(props, ref): React.JSX.Element {
		const {
			label,
			hideLabel = false,
			placeholder,
			hint,
			error,
			invalid = false,
			disabled = false,
			display,
			collapse = "middle",
			maxSegments = DEFAULT_MAX_SEGMENTS,
			renderValue,
			onClear,
			closeOnSelect = true,
			variant = "default",
			size = "md",
			className,
			testID,
			labels: labelOverrides,
			footer,
			items,
			getParent,
		} = props;
		const labels = React.useMemo((): CascaderLabels => ({ ...DEFAULT_CASCADER_LABELS, ...labelOverrides }), [labelOverrides]);
		const [open, setOpen] = React.useState(false);
		const index = React.useMemo(() => buildCascaderIndex(items, { getParent }), [getParent, items]);
		const values = props.multiple === true ? props.value : props.value === null ? [] : [props.value];
		const paths = values.map((value: string): readonly CascaderNode[] => cascaderPathOf(index, value)).filter((path: readonly CascaderNode[]): boolean => path.length > 0);
		const text = fieldTextOf(paths, display ?? (props.multiple === true ? "count" : "path"), collapse, maxSegments, labels);
		const hasError = error !== undefined && error.length > 0;
		const show = React.useCallback((): void => {
			setOpen(true);
		}, []);
		const hide = React.useCallback((): void => {
			setOpen(false);
		}, []);
		const singleChange = props.multiple === true ? undefined : props.onChange;
		const changeSingle = React.useCallback(
			(value: string, details: CascaderChangeDetails): void => {
				if (closeOnSelect) {
					setOpen(false);
				}
				singleChange?.(value, details);
			},
			[closeOnSelect, singleChange],
		);
		const sheetFooter = (
			<View className="gap-2">
				{footer}
				{props.multiple === true ? <Button label={labels.done} onPress={hide} /> : null}
			</View>
		);
		const lastNode = paths.at(0)?.at(-1);
		return (
			<View className={cn("gap-1.5", className)}>
				{hideLabel ? null : <Label>{label}</Label>}
				<SelectTrigger
					ref={ref}
					label={label}
					valueLabel={text}
					placeholder={placeholder}
					leading={props.multiple === true ? undefined : lastNode?.icon}
					valueContent={paths.length === 0 || renderValue === undefined ? undefined : renderValue(paths)}
					onClear={onClear}
					expanded={open}
					onPress={show}
					variant={variant}
					size={size}
					disabled={disabled}
					invalid={invalid || hasError}
					accessibilityHint="Opens the options"
					testID={testID}
				/>
				{hint === undefined ? null : <MutedText>{hint}</MutedText>}
				{hasError ? (
					<ErrorText accessibilityRole="alert" accessibilityLiveRegion="polite">
						{error}
					</ErrorText>
				) : null}
				<BottomSheet visible={open} title={label} onClose={hide} scrollsItself size="lg" testID={testID === undefined ? undefined : `${testID}-sheet`}>
					{props.multiple === true ? (
						<CascaderPanel {...props} footer={sheetFooter} className={undefined} testID={undefined} />
					) : (
						<CascaderPanel {...props} onChange={changeSingle} footer={sheetFooter} className={undefined} testID={undefined} />
					)}
				</BottomSheet>
			</View>
		);
	}),
);
