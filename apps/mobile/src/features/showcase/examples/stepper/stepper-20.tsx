import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import { Badge } from "@workspace/ui-native/components/badge";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "approve", label: "Approve" },
	{ value: "hold", label: "Put on hold" },
];
const STEPS: readonly StepperStep[] = [
	{ key: "po-1041", title: "PO-1041 · Office chairs", badge: <Badge label="Ready" tone="success" size="sm" /> },
	{ key: "po-1042", title: "PO-1042 · Laptops", badge: <Badge label="Review" tone="warning" size="sm" /> },
	{ key: "po-1043", title: "PO-1043 · Monitors", badge: <Badge label="Review" tone="warning" size="sm" /> },
];

export function Stepper20Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="flex-row gap-2">
			<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" completedTone="success" className="flex-1" />
			<DropdownMenu label={`${STEPS.at(step - 1)?.title ?? "Order"} actions`} icon={EllipsisVerticalIcon} size="icon" variant="ghost" items={ACTIONS} onSelect={ignorePress} />
		</View>
	);
}
