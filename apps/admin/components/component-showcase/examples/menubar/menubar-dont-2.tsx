import * as React from "react";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@workspace/ui/components/menubar";

export function MenubarDont2Example(): React.JSX.Element {
	return (
		<Menubar>
			<MenubarMenu>
				<MenubarTrigger>Account</MenubarTrigger>
				<MenubarContent>
					<MenubarItem>Sign out</MenubarItem>
					<MenubarItem>Profile</MenubarItem>
					<MenubarItem>Preferences</MenubarItem>
				</MenubarContent>
			</MenubarMenu>
		</Menubar>
	);
}
