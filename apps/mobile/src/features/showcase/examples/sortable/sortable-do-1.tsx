import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly string[] = ["Plan", "Build", "Ship"];

function idOf(step: string): string {
	return step;
}

export function SortableDo1Example(): React.JSX.Element {
	const [steps, setSteps] = React.useState<readonly string[]>(STEPS);
	return (
		<Sortable value={steps} onValueChange={setSteps} getItemValue={idOf} className="gap-2">
			{steps.map((step: string): React.JSX.Element => (
				<SortableItem key={step} value={step} label={step}>
					<View className="flex-row items-center gap-2 rounded-md border border-border px-1">
						<SortableItemHandle>
							<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
						</SortableItemHandle>
						<Text className="text-label font-sans text-foreground">{step}</Text>
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}
