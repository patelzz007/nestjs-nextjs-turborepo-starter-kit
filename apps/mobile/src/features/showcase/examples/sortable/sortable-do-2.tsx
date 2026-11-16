import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

const ROWS: readonly string[] = ["Email", "SMS"];

function idOf(row: string): string {
	return row;
}

export function SortableDo2Example(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly string[]>(ROWS);
	return (
		<Sortable value={rows} onValueChange={setRows} getItemValue={idOf} className="gap-2">
			{rows.map((row: string): React.JSX.Element => (
				<SortableItem key={row} value={row} label={row}>
					<View className="flex-row items-center gap-2 rounded-md border border-border px-1">
						<SortableItemHandle>
							<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
						</SortableItemHandle>
						<Text className="text-label font-sans text-foreground">{row}</Text>
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}
