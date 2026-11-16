import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import { Button } from "@workspace/ui-native/components/button";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Popover } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

interface Step {
	readonly title: string;
	readonly text: string;
}

const STEPS: readonly Step[] = [
	{ title: "Projects", text: "Every project you can see lives here." },
	{ title: "Search", text: "Find anything with the search at the top." },
	{ title: "Team", text: "Invite people and set what they can do." },
	{ title: "Billing", text: "Change plan or download invoices." },
];

export function Popover11Example(): React.JSX.Element {
	const [step, setStep] = React.useState(0);
	const current = STEPS.at(step) ?? STEPS.at(0);
	const back = React.useCallback((): void => {
		setStep((value: number): number => Math.max(value - 1, 0));
	}, []);
	const next = React.useCallback((): void => {
		setStep((value: number): number => Math.min(value + 1, STEPS.length - 1));
	}, []);
	const content = (
		<View className="gap-3">
			<Text className="text-caption font-sans text-muted-foreground">{`Step ${String(step + 1)} of ${String(STEPS.length)}`}</Text>
			<Text className="text-body-lg font-sans-semibold text-foreground">{current?.title ?? ""}</Text>
			<Text className="text-body font-sans text-foreground">{current?.text ?? ""}</Text>
			<View className="flex-row justify-end gap-2">
				<IconButton icon={ChevronLeftIcon} label="Previous step" variant="secondary" size="sm" onPress={back} disabled={step === 0} />
				<IconButton icon={ChevronRightIcon} label="Next step" variant="secondary" size="sm" onPress={next} disabled={step === STEPS.length - 1} />
			</View>
		</View>
	);
	return (
		<Popover content={content} accessibilityLabel="Tour" side="top">
			<Button label="Take the tour" variant="outline" onPress={ignorePress} />
		</Popover>
	);
}
