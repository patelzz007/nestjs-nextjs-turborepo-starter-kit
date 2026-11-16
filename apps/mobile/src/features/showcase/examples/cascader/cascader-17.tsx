import XIcon from "lucide-react-native/icons/x";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { Icon } from "@workspace/ui-native/components/icon";
import { buildCascaderIndex, type CascaderNode, cascaderPathOf } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

const TABLES: readonly CascaderNode[] = [
	{
		value: "orders",
		label: "orders",
		children: [
			{ value: "orders.id", label: "id" },
			{ value: "orders.total", label: "total" },
			{ value: "orders.created_at", label: "created_at" },
		],
	},
	{
		value: "customers",
		label: "customers",
		children: [
			{ value: "customers.id", label: "id" },
			{ value: "customers.email", label: "email" },
		],
	},
];
const INDEX = buildCascaderIndex(TABLES);
const INITIAL: readonly string[] = ["orders.id", "customers.id", "orders.total"];
/** The remove button's extra touch area around its 24 pt circle, to reach 44 pt (rules/04). */
const REMOVE_HIT_SLOP = 10;

interface ColumnChipProps {
	readonly value: string;
	readonly onRemove: (value: string) => void;
}

/** One picked column, named with its table so the two `id`s differ. */
function ColumnChip({ value, onRemove }: ColumnChipProps): React.JSX.Element {
	const label = cascaderPathOf(INDEX, value)
		.map((node: CascaderNode): string => node.label)
		.join(".");
	const remove = React.useCallback((): void => {
		onRemove(value);
	}, [onRemove, value]);
	return (
		<View className="flex-row items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-2.5">
			<Text className="text-caption font-mono text-secondary-foreground">{label}</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`Remove ${label}`}
				onPress={remove}
				hitSlop={REMOVE_HIT_SLOP}
				className="size-6 items-center justify-center rounded-full active:opacity-60">
				<Icon icon={XIcon} size="xs" colorClassName="accent-icon" />
			</Pressable>
		</View>
	);
}

export function Cascader17Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(INITIAL);
	const remove = React.useCallback((value: string): void => {
		setValues((current: readonly string[]): readonly string[] => current.filter((picked: string): boolean => picked !== value));
	}, []);
	return (
		<View className="gap-2">
			<Cascader label="Columns" items={TABLES} multiple value={values} onChange={setValues} placeholder="Add columns" />
			<View className="flex-row flex-wrap gap-1.5">
				{values.map((value: string): React.JSX.Element => (
					<ColumnChip key={value} value={value} onRemove={remove} />
				))}
			</View>
		</View>
	);
}
