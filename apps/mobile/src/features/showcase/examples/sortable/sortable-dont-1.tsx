import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly string[] = ["s1", "s2", "s3"];

function idOf(step: string): string {
	return step;
}

// No label: each handle is read as "Reorder s1" — the id, not the step's name.
export function SortableDont1Example(): React.JSX.Element {
	const [steps, setSteps] = React.useState<readonly string[]>(STEPS);
	return (
		<Sortable value={steps} onValueChange={setSteps} getItemValue={idOf} className="gap-2">
			{steps.map((step: string): React.JSX.Element => (
				<SortableItem key={step} value={step}>
					<View className="flex-row items-center gap-2 rounded-md border border-border px-1">
						<SortableItemHandle>
							<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
						</SortableItemHandle>
						<Text className="text-label font-sans text-foreground">Step</Text>
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}
