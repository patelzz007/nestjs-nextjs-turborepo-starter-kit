import Trash2Icon from "lucide-react-native/icons/trash-2";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

type Theme = "light" | "dark" | "system";

export function DropdownMenu8Example(): React.JSX.Element {
	const [theme, setTheme] = React.useState<Theme>("system");
	const [autosave, setAutosave] = React.useState(true);
	const items: readonly DropdownMenuItemData<string>[] = [
		{
			value: "recent",
			label: "Open recent",
			items: [
				{ value: "recent:roadmap", label: "roadmap.md" },
				{ value: "recent:notes", label: "notes.md" },
			],
		},
		{
			value: "theme",
			label: "Theme",
			items: [
				{ value: "light", label: "Light", kind: "radio", checked: theme === "light" },
				{ value: "dark", label: "Dark", kind: "radio", checked: theme === "dark" },
				{ value: "system", label: "System", kind: "radio", checked: theme === "system" },
			],
		},
		{ value: "autosave", label: "Autosave", kind: "checkbox", checked: autosave },
		{ value: "delete", label: "Delete file", icon: Trash2Icon, variant: "destructive", group: "Danger" },
	];
	const choose = React.useCallback((value: string): void => {
		if (value === "light" || value === "dark" || value === "system") {
			setTheme(value);
		}
		if (value === "autosave") {
			setAutosave((on: boolean): boolean => !on);
		}
	}, []);
	return <DropdownMenu label="File" items={items} onSelect={choose} />;
}
