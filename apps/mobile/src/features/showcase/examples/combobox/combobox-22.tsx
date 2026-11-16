import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import SignalLowIcon from "lucide-react-native/icons/signal-low";
import SignalMediumIcon from "lucide-react-native/icons/signal-medium";
import SignalHighIcon from "lucide-react-native/icons/signal-high";
import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";

const PRIORITIES: readonly ComboboxOption<string>[] = [
	{ value: "none", label: "No priority", leading: <Icon icon={EllipsisIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "urgent", label: "Urgent", leading: <Icon icon={TriangleAlertIcon} size="sm" colorClassName="accent-warning" /> },
	{ value: "high", label: "High", leading: <Icon icon={SignalHighIcon} size="sm" colorClassName="accent-foreground" /> },
	{ value: "medium", label: "Medium", leading: <Icon icon={SignalMediumIcon} size="sm" colorClassName="accent-foreground" /> },
	{ value: "low", label: "Low", leading: <Icon icon={SignalLowIcon} size="sm" colorClassName="accent-foreground" /> },
];

export function Combobox22Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("high");
	return <Combobox label="Priority" options={PRIORITIES} value={value} onChange={setValue} searchPlaceholder="Change priority…" />;
}
