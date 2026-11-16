import CircleDashedIcon from "lucide-react-native/icons/circle-dashed";
import CircleIcon from "lucide-react-native/icons/circle";
import CircleDotIcon from "lucide-react-native/icons/circle-dot";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";

const STATUSES: readonly ComboboxOption<string>[] = [
	{ value: "backlog", label: "Backlog", leading: <Icon icon={CircleDashedIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "todo", label: "Todo", leading: <Icon icon={CircleIcon} size="sm" colorClassName="accent-foreground" /> },
	{ value: "in-progress", label: "In Progress", leading: <Icon icon={CircleDotIcon} size="sm" colorClassName="accent-warning" /> },
	{ value: "done", label: "Done", leading: <Icon icon={CircleCheckIcon} size="sm" colorClassName="accent-success" /> },
	{ value: "cancelled", label: "Cancelled", leading: <Icon icon={CircleXIcon} size="sm" colorClassName="accent-destructive" /> },
];

export function Combobox21Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("todo");
	return <Combobox label="Status" options={STATUSES} value={value} onChange={setValue} searchPlaceholder="Change status…" />;
}
