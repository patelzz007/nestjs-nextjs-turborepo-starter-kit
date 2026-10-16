import * as React from "react";
import { FileIcon, FolderIcon, LogOutIcon, SaveIcon, UserIcon } from "lucide-react";
import { Menubar, MenubarContent, MenubarGroup, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from "@workspace/ui/components/menubar";

export function Menubar4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Menubar>
				<MenubarMenu>
					<MenubarTrigger>File</MenubarTrigger>
					<MenubarContent>
						<MenubarItem>
							<FileIcon />
							New File <MenubarShortcut>⌘N</MenubarShortcut>
						</MenubarItem>
						<MenubarItem>
							<FolderIcon />
							Open Folder
						</MenubarItem>
						<MenubarSeparator />
						<MenubarItem>
							<SaveIcon />
							Save <MenubarShortcut>⌘S</MenubarShortcut>
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
				<MenubarMenu>
					<MenubarTrigger>Account</MenubarTrigger>
					<MenubarContent>
						<MenubarGroup>
							<MenubarItem>
								<UserIcon />
								Profile
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem variant="destructive">
								<LogOutIcon />
								Sign out
							</MenubarItem>
						</MenubarGroup>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>
		</div>
	);
}
