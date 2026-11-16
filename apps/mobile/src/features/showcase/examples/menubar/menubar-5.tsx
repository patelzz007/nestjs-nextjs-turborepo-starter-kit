import BoldIcon from "lucide-react-native/icons/bold";
import ImageIcon from "lucide-react-native/icons/image";
import ItalicIcon from "lucide-react-native/icons/italic";
import LinkIcon from "lucide-react-native/icons/link";
import { Menubar, type MenubarMenu } from "@workspace/ui-native/components/menubar";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Menubar5Example(): React.JSX.Element {
	const [strike, setStrike] = React.useState(false);
	const [code, setCode] = React.useState(false);
	const format = React.useCallback((value: string): void => {
		if (value === "strike") {
			setStrike((on: boolean): boolean => !on);
		}
		if (value === "code") {
			setCode((on: boolean): boolean => !on);
		}
	}, []);
	const menus: readonly MenubarMenu[] = [
		{
			key: "format",
			label: "Format",
			onSelect: format,
			items: [
				{ value: "bold", label: "Bold", icon: BoldIcon, shortcut: ["⌘", "B"] },
				{ value: "italic", label: "Italic", icon: ItalicIcon, shortcut: ["⌘", "I"] },
				{ value: "strike", label: "Strikethrough", kind: "checkbox", checked: strike },
				{ value: "code", label: "Code", kind: "checkbox", checked: code },
			],
		},
		{
			key: "insert",
			label: "Insert",
			onSelect: ignorePress,
			items: [
				{
					value: "media",
					label: "Media",
					icon: ImageIcon,
					items: [
						{ value: "image", label: "Image" },
						{ value: "video", label: "Video" },
					],
				},
				{ value: "link", label: "Link", icon: LinkIcon },
			],
		},
	];
	return <Menubar menus={menus} />;
}
