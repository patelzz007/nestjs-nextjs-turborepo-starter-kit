import * as React from "react";
import { BoldIcon, ImageIcon, ItalicIcon, LinkIcon } from "lucide-react";
import {
	Menubar,
	MenubarCheckboxItem,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarSeparator,
	MenubarShortcut,
	MenubarSub,
	MenubarSubContent,
	MenubarSubTrigger,
	MenubarTrigger,
} from "@workspace/ui/components/menubar";

export function Menubar5Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Menubar>
				<MenubarMenu>
					<MenubarTrigger>Format</MenubarTrigger>
					<MenubarContent>
						<MenubarItem>
							<BoldIcon />
							Bold <MenubarShortcut>⌘B</MenubarShortcut>
						</MenubarItem>
						<MenubarItem>
							<ItalicIcon />
							Italic <MenubarShortcut>⌘I</MenubarShortcut>
						</MenubarItem>
						<MenubarSeparator />
						<MenubarCheckboxItem checked>Strikethrough</MenubarCheckboxItem>
						<MenubarCheckboxItem>Code</MenubarCheckboxItem>
					</MenubarContent>
				</MenubarMenu>
				<MenubarMenu>
					<MenubarTrigger>Insert</MenubarTrigger>
					<MenubarContent>
						<MenubarSub>
							<MenubarSubTrigger>
								<ImageIcon />
								Media
							</MenubarSubTrigger>
							<MenubarSubContent>
								<MenubarItem>Image</MenubarItem>
								<MenubarItem>Video</MenubarItem>
							</MenubarSubContent>
						</MenubarSub>
						<MenubarSeparator />
						<MenubarItem>
							<LinkIcon />
							Link <MenubarShortcut>⌘K</MenubarShortcut>
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>
		</div>
	);
}
