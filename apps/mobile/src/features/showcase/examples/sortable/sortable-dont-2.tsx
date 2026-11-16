import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

const ROWS: readonly string[] = ["Email", "SMS"];

function idOf(row: string): string {
	return row;
}

// A grip too small to land a thumb on: a 12 pt handle with no room around it.
export function SortableDont2Example(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly string[]>(ROWS);
	return (
		<Sortable value={rows} onValueChange={setRows} getItemValue={idOf} className="gap-2">
			{rows.map((row: string): React.JSX.Element => (
				<SortableItem key={row} value={row} label={row}>
					<View className="flex-row items-center gap-2 rounded-md border border-border px-1">
						<SortableItemHandle className="min-h-3 min-w-3">
							<Icon icon={GripVerticalIcon} size="xs" colorClassName="accent-muted-foreground" />
						</SortableItemHandle>
						<Text className="text-label font-sans text-foreground">{row}</Text>
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}
