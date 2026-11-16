import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

interface Panels {
	readonly status: boolean;
	readonly activity: boolean;
	readonly panel: boolean;
}

const INITIAL: Panels = { status: true, activity: false, panel: false };

export function DropdownMenu6Example(): React.JSX.Element {
	const [panels, setPanels] = React.useState<Panels>(INITIAL);
	const items: readonly DropdownMenuItemData<keyof Panels>[] = [
		{ value: "status", label: "Status bar", kind: "checkbox", checked: panels.status, group: "Appearance" },
		{ value: "activity", label: "Activity bar", kind: "checkbox", checked: panels.activity, disabled: true, group: "Appearance" },
		{ value: "panel", label: "Panel", kind: "checkbox", checked: panels.panel, group: "Appearance" },
	];
	const toggle = React.useCallback((key: keyof Panels): void => {
		setPanels((current: Panels): Panels => ({ ...current, [key]: !current[key] }));
	}, []);
	return <DropdownMenu label="View" items={items} onSelect={toggle} />;
}
