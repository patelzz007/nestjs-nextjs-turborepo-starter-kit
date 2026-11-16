import * as React from "react";
import { Menubar, MenubarContent, MenubarGroup, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "@workspace/ui/components/menubar";

export function MenubarDo2Example(): React.JSX.Element {
	return (
		<Menubar>
			<MenubarMenu>
				<MenubarTrigger>Account</MenubarTrigger>
				<MenubarContent>
					<MenubarGroup>
						<MenubarItem>Profile</MenubarItem>
						<MenubarItem>Preferences</MenubarItem>
					</MenubarGroup>
					<MenubarSeparator />
					<MenubarGroup>
						<MenubarItem variant="destructive">Sign out</MenubarItem>
					</MenubarGroup>
				</MenubarContent>
			</MenubarMenu>
		</Menubar>
	);
}
