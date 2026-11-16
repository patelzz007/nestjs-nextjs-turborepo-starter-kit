// A filter bar for a phone: each condition a chip ("Status is Open"), "Add filter" to pick a field (drilling into
// branches), its operator and its value in a sheet, a tap on a chip to change it, and All / Any between them.
// The `builder` mode lays the same query out as nested groups of rows, each group with its own All / Any.
//
// The web kit's `Filters` for a phone: the query model — rules and groups, operators by value type, values,
// validation, serialisation — is shared in @workspace/ui-kit-logic `filters`, so a query built on either platform reads
// the same on the other. The fields are the native kit's own (`FilterBarField`: Lucide icons, React Native editors).
// Every chip is a button named by its condition; every change reports why (`details.reason`).

import {
	applyFilterExclusiveSelection,
	createFilterGroup,
	createFilterIdFactory,
	createFilterRule,
	filterValueItems,
	FILTER_LIMITS,
	flattenFilterRules,
	getDefaultFilterOperator,
	getFilterArity,
	getFilterOperator,
	insertFilterNode,
	isFilterDateValue,
	isFilterGroup,
	operatorTakesValue,
	removeFilterNode,
	resolveFilterOperators,
	setFilterCombinator,
	updateFilterRule,
	visibleFilterOperators,
	type FilterChangeReason,
	type FilterCombinator,
	type FilterGroupNode,
	type FilterLabels,
	type FilterNode,
	type FilterOperator,
	type FilterOperatorCatalog,
	type FilterQuery,
	type FilterRule,
	type FilterValue,
	type FilterValueItem,
} from "@workspace/ui-kit-logic";
import { cva } from "class-variance-authority";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import PlusIcon from "lucide-react-native/icons/plus";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { AccessibilityInfo, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import {
	DEFAULT_FILTER_LABELS,
	DEFAULT_FILTER_OPERATORS,
	filterBarFieldAt,
	filterBarPathLabel,
	filterBarValueText,
	searchFilterBarFields,
	type FilterBarFieldMatch,
	type FilterBarEditorProps,
	type FilterBarField,
	type FilterBarOption,
} from "../lib/filters";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { DropdownMenu, type DropdownMenuItemData } from "./dropdown-menu";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { Input } from "./input";
import { SegmentedControl, type SegmentedOption } from "./segmented-control";
import { Textarea } from "./textarea";

export const filtersVariants = cva("w-full flex-row flex-wrap items-center gap-2");

export const filterChipVariants = cva("min-h-9 flex-row items-center gap-1 rounded-full border pr-1 pl-3 active:opacity-70", {
	variants: {
		size: { sm: "min-h-8", md: "min-h-9" },
		incomplete: { true: "border-dashed border-muted-foreground", false: "border-border bg-card" },
	},
	defaultVariants: { size: "md", incomplete: false },
});

export const filterGroupVariants = cva("gap-2 rounded-lg border border-border p-2", {
	variants: { depth: { root: "border-0 p-0", nested: "bg-muted/40" } },
	defaultVariants: { depth: "root" },
});

export type FilterBarMode = "bar" | "builder";

/** Why the query changed, and the rule it was about (none for a group or the whole query). */
export interface FilterBarChangeDetails {
	readonly reason: FilterChangeReason;
	readonly rule: FilterRule | null;
}

export interface FiltersProps {
	readonly fields: readonly FilterBarField[];
	readonly query: FilterQuery;
	readonly onQueryChange: (query: FilterQuery, details: FilterBarChangeDetails) => void;
	/** `bar` (chips, the default) or `builder` (nested groups of rows). */
	readonly mode?: FilterBarMode | undefined;
	readonly labels?: Partial<FilterLabels> | undefined;
	/** The operators by value type; the English catalog by default. */
	readonly operators?: FilterOperatorCatalog | undefined;
	readonly readOnly?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** A "Clear all" button once there is a filter. Default `true`. */
	readonly showClear?: boolean | undefined;
	readonly size?: "sm" | "md" | undefined;
	/** Where new rules' and groups' ids start. */
	readonly idSeed?: string | undefined;
	/** "Now" for relative dates (a fixed clock for a demo or a test). */
	readonly now?: Date | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const NO_OPTIONS: readonly FilterBarOption[] = [];

/** A value item as an input shows it: a scalar as text; nothing for no value or a date (dates have their own editors). */
function itemString(item: FilterValueItem | undefined): string {
	return item === null || item === undefined || isFilterDateValue(item) ? "" : String(item);
}

/** The sheet's state: picking a field (with the branch drilled into), or editing a rule (new or existing). */
type SheetState =
	| { readonly step: "field"; readonly trail: readonly string[]; readonly parentId: string }
	| { readonly step: "edit"; readonly rule: FilterRule; readonly isNew: boolean; readonly parentId: string };

type LoadState = "loading" | "ready" | "error";

/** Options fetched as the person searches (`loadOptions`), with loading and error states and a retry. */
function AsyncOptions({
	field,
	picked,
	multiple,
	labels,
	onToggle,
	onPick,
}: {
	readonly field: FilterBarField;
	readonly picked: readonly string[];
	readonly multiple: boolean;
	readonly labels: FilterLabels;
	readonly onToggle: (option: FilterBarOption, checked: boolean) => void;
	readonly onPick: (value: FilterValue) => void;
}): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	const [attempt, setAttempt] = React.useState(0);
	const [state, setState] = React.useState<{ readonly status: LoadState; readonly items: readonly FilterBarOption[] }>({ status: "loading", items: NO_OPTIONS });
	const { loadOptions } = field;
	React.useEffect((): (() => void) => {
		let current = true;
		loadOptions?.(query)
			.then((items): void => {
				if (current) {
					setState({ status: "ready", items });
				}
			})
			.catch((): void => {
				if (current) {
					setState({ status: "error", items: NO_OPTIONS });
				}
			});
		return (): void => {
			current = false;
		};
	}, [attempt, loadOptions, query]);
	const search = React.useCallback((text: string): void => {
		setState((previous) => ({ status: "loading", items: previous.items }));
		setQuery(text);
	}, []);
	const retry = React.useCallback((): void => {
		setState({ status: "loading", items: NO_OPTIONS });
		setAttempt((count): number => count + 1);
	}, []);
	return (
		<View className="gap-1">
			<Input value={query} onChange={search} accessibilityLabel={labels.searchOptions} placeholder={labels.searchOptions} />
			{state.status === "loading" ? <Text className="text-label font-sans text-muted-foreground">{labels.loading}</Text> : null}
			{state.status === "error" ? (
				<View className="flex-row items-center gap-2">
					<Text className="text-label flex-1 font-sans text-destructive-foreground">{labels.error}</Text>
					<Button label={labels.retry} variant="outline" size="sm" onPress={retry} />
				</View>
			) : null}
			{state.status === "ready" && state.items.length === 0 ? <Text className="text-label font-sans text-muted-foreground">{labels.empty}</Text> : null}
			{state.items.map((option): React.JSX.Element => (
				<OptionRow key={option.value} option={option} checked={picked.includes(option.value)} multiple={multiple} onToggle={multiple ? onToggle : undefined} onPick={onPick} />
			))}
		</View>
	);
}

/** The default value editor for a field's type and its operator's arity. */
function DefaultEditor({ field, operator, value, onValueChange, labels }: FilterBarEditorProps): React.JSX.Element | null {
	const arity = getFilterArity(operator);
	const items = filterValueItems(value);
	const type = field.type ?? "text";
	const options = field.options ?? NO_OPTIONS;
	const toggle = React.useCallback(
		(option: FilterBarOption, checked: boolean): void => {
			const current = items.map(String);
			const next = checked ? [...current, option.value] : current.filter((picked): boolean => picked !== option.value);
			const exclusive = new Set(options.filter((candidate): boolean => candidate.exclusive === true).map((candidate): string => candidate.value));
			onValueChange(applyFilterExclusiveSelection(next, current, (candidate): boolean => exclusive.has(candidate)));
		},
		[items, onValueChange, options],
	);
	const setText = React.useCallback(
		(text: string): void => {
			onValueChange(type === "number" ? (text.trim() === "" || Number.isNaN(Number(text)) ? undefined : Number(text)) : text);
		},
		[onValueChange, type],
	);
	const setLines = React.useCallback(
		(text: string): void => {
			onValueChange(text.split("\n").filter((line): boolean => line.trim() !== ""));
		},
		[onValueChange],
	);
	const [from, to] = items;
	const setFrom = React.useCallback(
		(text: string): void => {
			onValueChange([text.trim() === "" ? null : Number(text), to ?? null]);
		},
		[onValueChange, to],
	);
	const setTo = React.useCallback(
		(text: string): void => {
			onValueChange([from ?? null, text.trim() === "" ? null : Number(text)]);
		},
		[from, onValueChange],
	);
	const booleanOptions = React.useMemo(
		(): SegmentedOption<"true" | "false">[] => [
			{ value: "true", label: labels.booleanTrue },
			{ value: "false", label: labels.booleanFalse },
		],
		[labels.booleanFalse, labels.booleanTrue],
	);
	const setBoolean = React.useCallback(
		(choice: "true" | "false"): void => {
			onValueChange(choice === "true");
		},
		[onValueChange],
	);
	if (arity === "none") {
		return null;
	}
	if (type === "boolean") {
		return <SegmentedControl label={field.label} options={booleanOptions} value={value === false ? "false" : "true"} onChange={setBoolean} />;
	}
	if (field.loadOptions !== undefined) {
		return (
			<AsyncOptions field={field} picked={items.map(String)} multiple={arity === "many" || type === "multiselect"} labels={labels} onToggle={toggle} onPick={onValueChange} />
		);
	}
	if (options.length > 0) {
		const multiple = arity === "many" || type === "multiselect";
		return (
			<View className="gap-1">
				{options.map((option): React.JSX.Element => (
					<OptionRow
						key={option.value}
						option={option}
						checked={items.map(String).includes(option.value)}
						multiple={multiple}
						onToggle={multiple ? toggle : undefined}
						onPick={onValueChange}
					/>
				))}
			</View>
		);
	}
	if (arity === "range" || type === "range") {
		return (
			<View className="flex-row gap-2">
				<Input value={itemString(from)} onChange={setFrom} keyboardType="numeric" accessibilityLabel={labels.rangeFrom(field.label)} className="flex-1" />
				<Input value={itemString(to)} onChange={setTo} keyboardType="numeric" accessibilityLabel={labels.rangeTo(field.label)} className="flex-1" />
			</View>
		);
	}
	if (arity === "many") {
		return <Textarea value={items.map(String).join("\n")} onChange={setLines} accessibilityLabel={field.label} placeholder={field.placeholder ?? labels.valuePlaceholder} />;
	}
	return (
		<Input
			value={itemString(filterValueItems(value).at(0))}
			onChange={setText}
			keyboardType={type === "number" ? "numeric" : "default"}
			accessibilityLabel={field.label}
			placeholder={field.placeholder ?? labels.valuePlaceholder}
			trailing={field.unit === undefined ? undefined : <Text className="text-label font-sans text-muted-foreground">{field.unit}</Text>}
		/>
	);
}

/** One option: a checkbox among several picks, or a row that picks it alone. */
const OptionRow = React.memo(function OptionRow({
	option,
	checked,
	multiple,
	onToggle,
	onPick,
}: {
	readonly option: FilterBarOption;
	readonly checked: boolean;
	readonly multiple: boolean;
	readonly onToggle: ((option: FilterBarOption, checked: boolean) => void) | undefined;
	readonly onPick: (value: FilterValue) => void;
}): React.JSX.Element {
	const handleCheck = React.useCallback(
		(next: boolean): void => {
			onToggle?.(option, next);
		},
		[onToggle, option],
	);
	const handlePick = React.useCallback((): void => {
		onPick(option.value);
	}, [onPick, option.value]);
	const leading = option.leading ?? (option.icon === undefined ? undefined : <Icon icon={option.icon} size="sm" colorClassName="accent-muted-foreground" />);
	if (multiple) {
		return <Checkbox label={option.label} description={option.description} checked={checked} onChange={handleCheck} disabled={option.disabled} leading={leading} />;
	}
	const state = { selected: checked, disabled: option.disabled === true };
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={option.label}
			accessibilityState={state}
			disabled={option.disabled}
			onPress={handlePick}
			className="min-h-11 flex-row items-center gap-3 active:opacity-70">
			{leading ?? null}
			<Text className={cn("text-body flex-1 font-sans", option.disabled === true ? "text-muted-foreground" : "text-foreground")}>{option.label}</Text>
			{checked ? <Icon icon={ChevronRightIcon} size="sm" colorClassName="accent-primary" /> : null}
		</Pressable>
	);
});

/** A rule as a chip: its condition in words, a button that edits it, and one that removes it. */
const FilterChip = React.memo(function FilterChip({
	rule,
	text,
	incomplete,
	size,
	locked,
	labels,
	onEdit,
	onRemove,
}: {
	readonly rule: FilterRule;
	readonly text: string;
	readonly incomplete: boolean;
	readonly size: "sm" | "md";
	readonly locked: boolean;
	readonly labels: FilterLabels;
	readonly onEdit: (rule: FilterRule) => void;
	readonly onRemove: (rule: FilterRule) => void;
}): React.JSX.Element {
	const edit = React.useCallback((): void => {
		onEdit(rule);
	}, [onEdit, rule]);
	const remove = React.useCallback((): void => {
		onRemove(rule);
	}, [onRemove, rule]);
	return (
		<View className={filterChipVariants({ size, incomplete })}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={labels.filterLabel(text)}
				accessibilityHint={incomplete ? labels.incomplete : undefined}
				disabled={locked}
				onPress={edit}
				className="shrink active:opacity-70">
				<Text numberOfLines={1} className="text-label font-sans text-foreground">
					{text}
				</Text>
			</Pressable>
			{locked ? null : <IconButton icon={XIcon} label={`${labels.remove} ${text}`} onPress={remove} variant="ghost" size="sm" />}
		</View>
	);
});

export const Filters = React.memo(
	React.forwardRef<ViewInstance, FiltersProps>(function Filters(
		{
			fields,
			query,
			onQueryChange,
			mode = "bar",
			labels: labelsOverride,
			operators = DEFAULT_FILTER_OPERATORS,
			readOnly = false,
			disabled = false,
			showClear = true,
			size = "md",
			idSeed = "filter",
			now,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const labels = React.useMemo((): FilterLabels => ({ ...DEFAULT_FILTER_LABELS, ...labelsOverride }), [labelsOverride]);
		const nextId = React.useMemo(() => createFilterIdFactory(idSeed), [idSeed]);
		const [sheet, setSheet] = React.useState<SheetState | null>(null);
		const today = React.useMemo((): Date => now ?? new Date(), [now]);
		const locked = readOnly || disabled;
		// Options for stored values no search has loaded yet (`resolveValues`), by field path, so chips can name them.
		const [resolved, setResolved] = React.useState<ReadonlyMap<string, readonly FilterBarOption[]>>(() => new Map());
		// Asked once per value: a value `resolveValues` cannot name is not asked about again.
		const requested = React.useRef(new Set<string>());
		React.useEffect((): (() => void) => {
			let current = true;
			for (const rule of flattenFilterRules(query)) {
				const field = filterBarFieldAt(fields, rule.path);
				const key = rule.path.join("/");
				const known = new Set([...(field?.options ?? []), ...(resolved.get(key) ?? [])].map((option): string => option.value));
				const missing = filterValueItems(rule.value)
					.map((item): string => itemString(item))
					.filter((value): boolean => value !== "" && !known.has(value) && !requested.current.has(`${key}:${value}`));
				for (const value of missing) {
					requested.current.add(`${key}:${value}`);
				}
				if (field?.resolveValues !== undefined && missing.length > 0) {
					field
						.resolveValues(missing)
						.then((found): void => {
							if (current) {
								setResolved((previous): ReadonlyMap<string, readonly FilterBarOption[]> => new Map(previous).set(key, [...(previous.get(key) ?? []), ...found]));
							}
						})
						// A value that cannot be named reads as its id: nothing to report.
						.catch((): void => undefined);
				}
			}
			return (): void => {
				current = false;
			};
		}, [fields, query, resolved]);

		const operatorsOf = React.useCallback(
			(field: FilterBarField | undefined): readonly FilterOperator[] => (field === undefined ? [] : resolveFilterOperators(field, operators)),
			[operators],
		);
		const textOf = React.useCallback(
			(rule: FilterRule): string => {
				const found = filterBarFieldAt(fields, rule.path);
				const extra = resolved.get(rule.path.join("/"));
				const field = found === undefined || extra === undefined ? found : { ...found, options: [...(found.options ?? []), ...extra] };
				const operator = getFilterOperator(operatorsOf(field), rule.operator);
				const operatorText = operator === undefined ? rule.operator : rule.negated === true ? labels.negated(operator.label) : operator.label;
				const valueText = filterBarValueText(rule.value, field, operator, labels, today);
				return [filterBarPathLabel(fields, rule.path, labels.pathSeparator), operatorText, valueText].filter((part): boolean => part !== "").join(" ");
			},
			[fields, labels, operatorsOf, resolved, today],
		);
		const isIncomplete = React.useCallback(
			(rule: FilterRule): boolean => {
				const operator = getFilterOperator(operatorsOf(filterBarFieldAt(fields, rule.path)), rule.operator);
				return operator === undefined || (operatorTakesValue(operator) && filterValueItems(rule.value).length === 0);
			},
			[fields, operatorsOf],
		);
		const change = React.useCallback(
			(next: FilterQuery, reason: FilterChangeReason, rule: FilterRule | null): void => {
				onQueryChange(next, { reason, rule });
			},
			[onQueryChange],
		);

		// ── The sheet ──
		const openAdd = React.useCallback((parentId: string): void => {
			setSheet({ step: "field", trail: [], parentId });
		}, []);
		const openAddAtRoot = React.useCallback((): void => {
			openAdd(query.id);
		}, [openAdd, query.id]);
		const openEdit = React.useCallback(
			(rule: FilterRule): void => {
				setSheet({ step: "edit", rule, isNew: false, parentId: query.id });
			},
			[query.id],
		);
		const close = React.useCallback((): void => {
			setSheet(null);
		}, []);
		const pickField = React.useCallback(
			(field: FilterBarField): void => {
				setSheet((current): SheetState | null => {
					if (current?.step !== "field") {
						return current;
					}
					const path = [...current.trail, field.id];
					if ((field.fields ?? []).length > 0) {
						return { ...current, trail: path };
					}
					const operator = getDefaultFilterOperator(field, operatorsOf(field)) ?? "";
					return { step: "edit", rule: createFilterRule({ id: nextId(), path, operator }), isNew: true, parentId: current.parentId };
				});
			},
			[nextId, operatorsOf],
		);
		const pickPath = React.useCallback(
			(path: readonly string[]): void => {
				const field = filterBarFieldAt(fields, path);
				const operator = field === undefined ? "" : (getDefaultFilterOperator(field, operatorsOf(field)) ?? "");
				setSheet((current): SheetState | null =>
					current === null ? current : { step: "edit", rule: createFilterRule({ id: nextId(), path, operator }), isNew: true, parentId: current.parentId },
				);
			},
			[fields, nextId, operatorsOf],
		);
		const back = React.useCallback((): void => {
			setSheet((current): SheetState | null => (current?.step === "field" ? { ...current, trail: current.trail.slice(0, -1) } : current));
		}, []);
		const setDraftRule = React.useCallback((rule: FilterRule): void => {
			setSheet((current): SheetState | null => (current?.step === "edit" ? { ...current, rule } : current));
		}, []);
		const commit = React.useCallback((): void => {
			if (sheet?.step !== "edit") {
				return;
			}
			const { rule, isNew, parentId } = sheet;
			const next = isNew ? insertFilterNode(query, rule, parentId) : updateFilterRule(query, rule.id, { operator: rule.operator, value: rule.value, negated: rule.negated });
			change(next, isNew ? "add" : "update", rule);
			AccessibilityInfo.announceForAccessibility(labels.filterLabel(textOf(rule)));
			setSheet(null);
		}, [change, labels, query, sheet, textOf]);
		const removeRule = React.useCallback(
			(rule: FilterRule): void => {
				change(removeFilterNode(query, rule.id), "remove", rule);
			},
			[change, query],
		);
		const removeEdited = React.useCallback((): void => {
			if (sheet?.step === "edit" && !sheet.isNew) {
				removeRule(sheet.rule);
			}
			setSheet(null);
		}, [removeRule, sheet]);
		const clearAll = React.useCallback((): void => {
			change({ ...query, rules: [] }, "clear", null);
		}, [change, query]);
		const setCombinator = React.useCallback(
			(groupId: string, combinator: FilterCombinator): void => {
				change(setFilterCombinator(query, groupId, combinator), "combinator", null);
			},
			[change, query],
		);
		const addGroup = React.useCallback(
			(parentId: string): void => {
				change(insertFilterNode(query, createFilterGroup({ id: nextId(), combinator: "or" }), parentId), "add", null);
			},
			[change, nextId, query],
		);
		const removeGroup = React.useCallback(
			(groupId: string): void => {
				change(removeFilterNode(query, groupId), "remove", null);
			},
			[change, query],
		);

		const editingField = sheet?.step === "edit" ? filterBarFieldAt(fields, sheet.rule.path) : undefined;
		const sheetTitle = sheet === null ? labels.addFilter : sheet.step === "edit" ? filterBarPathLabel(fields, sheet.rule.path, labels.pathSeparator) : labels.addFilter;

		const chips = (group: FilterGroupNode): React.ReactNode =>
			group.rules.map((node: FilterNode): React.JSX.Element | null =>
				isFilterGroup(node) ? null : (
					<FilterChip
						key={node.id}
						rule={node}
						text={textOf(node)}
						incomplete={isIncomplete(node)}
						size={size}
						locked={locked}
						labels={labels}
						onEdit={openEdit}
						onRemove={removeRule}
					/>
				),
			);

		return (
			<View
				ref={ref}
				testID={testID}
				accessibilityLabel={labels.filtersLabel}
				className={cn(mode === "bar" ? filtersVariants() : "w-full gap-2", disabled ? "opacity-60" : "", className)}>
				{mode === "bar" ? (
					<>
						{query.rules.length > 1 ? <CombinatorSwitch groupId={query.id} combinator={query.combinator} labels={labels} locked={locked} onChange={setCombinator} /> : null}
						{chips(query)}
						{locked ? null : <Button label={labels.addFilter} icon={PlusIcon} variant="outline" size="sm" onPress={openAddAtRoot} />}
						{showClear && !locked && query.rules.length > 0 ? <Button label={labels.clearAll} variant="ghost" size="sm" onPress={clearAll} /> : null}
					</>
				) : (
					<BuilderGroup
						group={query}
						depth={0}
						labels={labels}
						locked={locked}
						textOf={textOf}
						isIncomplete={isIncomplete}
						size={size}
						onEdit={openEdit}
						onRemoveRule={removeRule}
						onAddRule={openAdd}
						onAddGroup={addGroup}
						onRemoveGroup={removeGroup}
						onCombinator={setCombinator}
					/>
				)}
				<BottomSheet visible={sheet !== null} title={sheetTitle} onClose={close}>
					{sheet?.step === "field" ? <FieldPicker fields={fields} trail={sheet.trail} labels={labels} onPick={pickField} onPickPath={pickPath} onBack={back} /> : null}
					{sheet?.step === "edit" ? (
						<RuleEditor
							rule={sheet.rule}
							field={editingField}
							operators={operatorsOf(editingField)}
							labels={labels}
							isNew={sheet.isNew}
							onChange={setDraftRule}
							onDone={commit}
							onRemove={removeEdited}
						/>
					) : null}
				</BottomSheet>
			</View>
		);
	}),
);

/** All / Any between a group's conditions. */
function CombinatorSwitch({
	groupId,
	combinator,
	labels,
	locked,
	onChange,
}: {
	readonly groupId: string;
	readonly combinator: FilterCombinator;
	readonly labels: FilterLabels;
	readonly locked: boolean;
	readonly onChange: (groupId: string, combinator: FilterCombinator) => void;
}): React.JSX.Element {
	const options = React.useMemo(
		(): SegmentedOption<FilterCombinator>[] => [
			{ value: "and", label: labels.groupAll },
			{ value: "or", label: labels.groupAny },
		],
		[labels.groupAll, labels.groupAny],
	);
	const handleChange = React.useCallback(
		(next: FilterCombinator): void => {
			onChange(groupId, next);
		},
		[groupId, onChange],
	);
	return <SegmentedControl label={labels.combinator} options={options} value={combinator} onChange={handleChange} size="sm" disabled={locked} />;
}

/** The field list: a search across every level, or the level drilled into with its branches opening deeper. */
function FieldPicker({
	fields,
	trail,
	labels,
	onPick,
	onPickPath,
	onBack,
}: {
	readonly fields: readonly FilterBarField[];
	readonly trail: readonly string[];
	readonly labels: FilterLabels;
	readonly onPick: (field: FilterBarField) => void;
	readonly onPickPath: (path: readonly string[]) => void;
	readonly onBack: () => void;
}): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	const matches = React.useMemo((): readonly FilterBarFieldMatch[] => (query.trim() === "" ? [] : searchFilterBarFields(fields, query)), [fields, query]);
	const level = trail.length === 0 ? fields : (filterBarFieldAt(fields, trail)?.fields ?? []);
	return (
		<View accessibilityLabel={labels.fieldsLabel} className="gap-1">
			<Input value={query} onChange={setQuery} accessibilityLabel={labels.searchFields} placeholder={labels.searchFields} />
			{query.trim() === "" ? (
				<>
					{trail.length === 0 ? null : (
						<Button label={`${labels.back}: ${filterBarPathLabel(fields, trail, labels.pathSeparator)}`} variant="ghost" size="sm" onPress={onBack} className="self-start" />
					)}
					{level.map((field): React.JSX.Element => (
						<FieldRow key={field.id} field={field} labels={labels} onPick={onPick} />
					))}
				</>
			) : (
				<>
					{matches.length === 0 ? <Text className="text-label font-sans text-muted-foreground">{labels.empty}</Text> : null}
					{matches.map((match): React.JSX.Element => (
						<MatchRow key={match.path.join("/")} match={match} label={filterBarPathLabel(fields, match.path, labels.pathSeparator)} onPick={onPickPath} />
					))}
				</>
			)}
		</View>
	);
}

/** A field the search found, named by its whole path. */
const MatchRow = React.memo(function MatchRow({
	match,
	label,
	onPick,
}: {
	readonly match: FilterBarFieldMatch;
	readonly label: string;
	readonly onPick: (path: readonly string[]) => void;
}): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(match.path);
	}, [match.path, onPick]);
	return (
		<Pressable accessibilityRole="button" accessibilityLabel={label} onPress={pick} className="min-h-11 flex-row items-center gap-3 active:opacity-70">
			{match.field.icon === undefined ? null : <Icon icon={match.field.icon} size="sm" colorClassName="accent-muted-foreground" />}
			<Text className="text-body flex-1 font-sans text-foreground">{label}</Text>
		</Pressable>
	);
});

const FieldRow = React.memo(function FieldRow({
	field,
	labels,
	onPick,
}: {
	readonly field: FilterBarField;
	readonly labels: FilterLabels;
	readonly onPick: (field: FilterBarField) => void;
}): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(field);
	}, [field, onPick]);
	const branch = (field.fields ?? []).length > 0;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={field.label}
			accessibilityHint={branch ? labels.branchAffordance : field.description}
			disabled={field.disabled}
			onPress={pick}
			className="min-h-11 flex-row items-center gap-3 active:opacity-70">
			{field.icon === undefined ? null : <Icon icon={field.icon} size="sm" colorClassName="accent-muted-foreground" />}
			<Text className={cn("text-body flex-1 font-sans", field.disabled === true ? "text-muted-foreground" : "text-foreground")}>{field.label}</Text>
			{branch ? <Icon icon={ChevronRightIcon} size="sm" colorClassName="accent-muted-foreground" /> : null}
		</Pressable>
	);
});

/** A rule's operator (and negation) and value, with Done and, for a saved rule, Remove. */
function RuleEditor({
	rule,
	field,
	operators,
	labels,
	isNew,
	onChange,
	onDone,
	onRemove,
}: {
	readonly rule: FilterRule;
	readonly field: FilterBarField | undefined;
	readonly operators: readonly FilterOperator[];
	readonly labels: FilterLabels;
	readonly isNew: boolean;
	readonly onChange: (rule: FilterRule) => void;
	readonly onDone: () => void;
	readonly onRemove: () => void;
}): React.JSX.Element | null {
	const operator = getFilterOperator(operators, rule.operator);
	const items = React.useMemo(
		(): DropdownMenuItemData<string>[] =>
			visibleFilterOperators(operators).map((option): DropdownMenuItemData<string> => ({
				value: option.value,
				label: option.label,
				kind: "radio",
				checked: option.value === rule.operator,
			})),
		[operators, rule.operator],
	);
	const setOperator = React.useCallback(
		(next: string): void => {
			const nextOperator = getFilterOperator(operators, next);
			const keepValue = getFilterArity(nextOperator) === getFilterArity(operator);
			onChange(keepValue || rule.value === undefined ? { ...rule, operator: next } : { id: rule.id, type: "rule", path: rule.path, operator: next });
		},
		[onChange, operator, operators, rule],
	);
	const setValue = React.useCallback(
		(value: FilterValue | undefined): void => {
			onChange(
				value === undefined
					? { id: rule.id, type: "rule", path: rule.path, operator: rule.operator, ...(rule.negated === true ? { negated: true } : {}) }
					: { ...rule, value },
			);
		},
		[onChange, rule],
	);
	if (field === undefined || operator === undefined) {
		return null;
	}
	const Editor = field.editor ?? DefaultEditor;
	const error = field.validate?.(rule.value) ?? null;
	return (
		<View className="gap-3">
			<DropdownMenu label={operator.label} title={labels.selectCondition} items={items} onSelect={setOperator} size="sm" />
			<Editor field={field} operator={operator} value={rule.value} onValueChange={setValue} labels={labels} />
			{error === null ? null : (
				<Text accessibilityRole="alert" className="text-caption font-sans text-destructive-foreground">
					{error}
				</Text>
			)}
			<View className="flex-row gap-2">
				{isNew ? null : <Button label={labels.remove} variant="outline" onPress={onRemove} className="flex-1" />}
				<Button label={labels.apply} onPress={onDone} disabled={error !== null} className="flex-1" />
			</View>
		</View>
	);
}

interface BuilderGroupProps {
	readonly group: FilterGroupNode;
	readonly depth: number;
	readonly labels: FilterLabels;
	readonly locked: boolean;
	readonly size: "sm" | "md";
	readonly textOf: (rule: FilterRule) => string;
	readonly isIncomplete: (rule: FilterRule) => boolean;
	readonly onEdit: (rule: FilterRule) => void;
	readonly onRemoveRule: (rule: FilterRule) => void;
	readonly onAddRule: (parentId: string) => void;
	readonly onAddGroup: (parentId: string) => void;
	readonly onRemoveGroup: (groupId: string) => void;
	readonly onCombinator: (groupId: string, combinator: FilterCombinator) => void;
}

/** One group of the builder: All / Any, its rows (rules as chips, groups nested), and buttons to add more. */
function BuilderGroup(props: BuilderGroupProps): React.JSX.Element {
	const { group, depth, labels, locked, size, textOf, isIncomplete, onEdit, onRemoveRule, onAddRule, onAddGroup, onRemoveGroup, onCombinator } = props;
	const addRule = React.useCallback((): void => {
		onAddRule(group.id);
	}, [group.id, onAddRule]);
	const addGroup = React.useCallback((): void => {
		onAddGroup(group.id);
	}, [group.id, onAddGroup]);
	const removeGroup = React.useCallback((): void => {
		onRemoveGroup(group.id);
	}, [group.id, onRemoveGroup]);
	const canNest = depth + 1 < FILTER_LIMITS.maxDepth;
	return (
		<View
			accessibilityLabel={labels.groupLabel(group.combinator === "and" ? labels.groupAll : labels.groupAny, depth)}
			className={filterGroupVariants({ depth: depth === 0 ? "root" : "nested" })}>
			<View className="flex-row items-center gap-2">
				<CombinatorSwitch groupId={group.id} combinator={group.combinator} labels={labels} locked={locked} onChange={onCombinator} />
				{depth === 0 || locked ? null : <IconButton icon={XIcon} label={labels.removeGroup} onPress={removeGroup} variant="ghost" size="sm" className="ml-auto" />}
			</View>
			{group.rules.length === 0 ? <Text className="text-caption font-sans text-muted-foreground">{labels.builderEmpty}</Text> : null}
			{group.rules.map((node: FilterNode): React.JSX.Element =>
				isFilterGroup(node) ? (
					<BuilderGroup key={node.id} {...props} group={node} depth={depth + 1} />
				) : (
					<View key={node.id} className="flex-row">
						<FilterChip rule={node} text={textOf(node)} incomplete={isIncomplete(node)} size={size} locked={locked} labels={labels} onEdit={onEdit} onRemove={onRemoveRule} />
					</View>
				),
			)}
			{locked ? null : (
				<View className="flex-row flex-wrap gap-2">
					<Button label={labels.addCondition} icon={PlusIcon} variant="outline" size="sm" onPress={addRule} />
					{canNest ? <Button label={labels.addConditionGroup} icon={PlusIcon} variant="ghost" size="sm" onPress={addGroup} /> : null}
				</View>
			)}
		</View>
	);
}
