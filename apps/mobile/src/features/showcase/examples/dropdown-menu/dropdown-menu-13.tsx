import FileTextIcon from "lucide-react-native/icons/file-text";
import ImageIcon from "lucide-react-native/icons/image";
import LinkIcon from "lucide-react-native/icons/link";
import MailIcon from "lucide-react-native/icons/mail";
import PrinterIcon from "lucide-react-native/icons/printer";
import ShareIcon from "lucide-react-native/icons/share";
import SheetIcon from "lucide-react-native/icons/sheet";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "email", label: "Email", icon: MailIcon, group: "Share" },
	{ value: "link", label: "Copy link", icon: LinkIcon, group: "Share" },
	{ value: "pdf", label: "PDF", icon: FileTextIcon, group: "Export" },
	{ value: "csv", label: "CSV", icon: SheetIcon, group: "Export" },
	{ value: "png", label: "PNG", icon: ImageIcon, group: "Export" },
	{ value: "print", label: "Print", icon: PrinterIcon, group: "Print" },
];

export function DropdownMenu13Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choose = React.useCallback((value: string): void => {
		setPicked(value);
	}, []);
	return (
		<View className="gap-2">
			<DropdownMenu label="Share" icon={ShareIcon} items={ITEMS} onSelect={choose} />
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
