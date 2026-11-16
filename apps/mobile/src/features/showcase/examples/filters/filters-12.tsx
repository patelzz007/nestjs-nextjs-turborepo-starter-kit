import { formatMessage } from "@workspace/shared";
import {
	buildFilterLabels,
	createFilterOperators,
	createFilterQuery,
	createFilterRule,
	FILTER_MESSAGES_EN,
	FILTER_OPERATOR_LABELS_EN,
	type FilterLabels,
	type FilterOperatorCatalog,
	type FilterQuery,
} from "@workspace/ui-kit-logic";
import { SegmentedControl } from "@workspace/ui-native/components/segmented-control";
import { Switch } from "@workspace/ui-native/components/switch";
import { Filters, type FilterBarChangeDetails } from "@workspace/ui-native/components/filters";
import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";
import { Text, View } from "react-native";

import { PRIORITIES, STATUSES } from "./filters-sample";

type Language = "en" | "de" | "ja";
type Size = "sm" | "md";

/** German and Japanese chrome: only the strings a caller overrides; the rest stay English. */
const GERMAN: Partial<FilterLabels> = { addFilter: "Filter hinzufügen", clearAll: "Alle löschen", searchFields: "Felder suchen", apply: "Anwenden", remove: "Entfernen" };
const JAPANESE: Partial<FilterLabels> = { addFilter: "フィルターを追加", clearAll: "すべてクリア", searchFields: "フィールドを検索", apply: "適用", remove: "削除" };

const OPERATORS: Readonly<Record<Language, FilterOperatorCatalog>> = {
	en: createFilterOperators(FILTER_OPERATOR_LABELS_EN),
	de: createFilterOperators({
		...FILTER_OPERATOR_LABELS_EN,
		is: "ist",
		is_not: "ist nicht",
		has_any_of: "enthält eines von",
		has_none_of: "enthält keines von",
		contains: "enthält",
	}),
	ja: createFilterOperators({
		...FILTER_OPERATOR_LABELS_EN,
		is: "が次と一致",
		is_not: "が次と不一致",
		has_any_of: "のいずれか",
		has_none_of: "のいずれでもない",
		contains: "を含む",
	}),
};

const LABELS: Readonly<Record<Language, Partial<FilterLabels>>> = {
	en: buildFilterLabels(FILTER_MESSAGES_EN, (message, values): string => formatMessage("en", message, values)),
	de: GERMAN,
	ja: JAPANESE,
};

const FIELD_NAMES: Readonly<Record<Language, { readonly status: string; readonly priority: string }>> = {
	en: { status: "Status", priority: "Priority" },
	de: { status: "Status", priority: "Priorität" },
	ja: { status: "ステータス", priority: "優先度" },
};

const LANGUAGES: readonly { readonly value: Language; readonly label: string }[] = [
	{ value: "en", label: "English" },
	{ value: "de", label: "Deutsch" },
	{ value: "ja", label: "日本語" },
];
const SIZES: readonly { readonly value: Size; readonly label: string }[] = [
	{ value: "md", label: "Medium" },
	{ value: "sm", label: "Small" },
];
/** How many changes the log keeps. */
const LOG_LENGTH = 4;

const SEED: FilterQuery = createFilterQuery([createFilterRule({ id: "seed", path: ["status"], operator: "has_any_of", value: ["todo"] })]);

// A controlled bar: its words in three languages, two sizes, read-only or disabled, and every change logged.
export function Filters12Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(SEED);
	const [language, setLanguage] = React.useState<Language>("en");
	const [size, setSize] = React.useState<Size>("md");
	const [readOnly, setReadOnly] = React.useState(false);
	const [disabled, setDisabled] = React.useState(false);
	const [log, setLog] = React.useState<readonly string[]>([]);
	const change = React.useCallback((next: FilterQuery, details: FilterBarChangeDetails): void => {
		setQuery(next);
		setLog((current: readonly string[]): readonly string[] =>
			[`${details.reason}${details.rule === null ? "" : ` · ${details.rule.path.join(".")}`}`, ...current].slice(0, LOG_LENGTH),
		);
	}, []);
	const names = FIELD_NAMES[language];
	const fields = React.useMemo(
		(): readonly FilterBarField[] => [
			{ id: "status", label: names.status, type: "multiselect", options: STATUSES },
			{ id: "priority", label: names.priority, type: "select", options: PRIORITIES },
		],
		[names],
	);
	return (
		<View className="w-full gap-3">
			<SegmentedControl label="Language" options={LANGUAGES} value={language} onChange={setLanguage} />
			<SegmentedControl label="Size" options={SIZES} value={size} onChange={setSize} />
			<Switch label="Read-only" checked={readOnly} onChange={setReadOnly} />
			<Switch label="Disabled" checked={disabled} onChange={setDisabled} />
			<Filters
				fields={fields}
				query={query}
				onQueryChange={change}
				labels={LABELS[language]}
				operators={OPERATORS[language]}
				size={size}
				readOnly={readOnly}
				disabled={disabled}
			/>
			<View className="gap-1">
				{log.length === 0 ? <Text className="text-caption font-sans text-muted-foreground">Changes appear here.</Text> : null}
				{log.map((entry: string, index: number): React.JSX.Element => (
					<Text key={`${String(log.length - index)}-${entry}`} className="text-caption font-mono text-muted-foreground">
						{entry}
					</Text>
				))}
			</View>
		</View>
	);
}
