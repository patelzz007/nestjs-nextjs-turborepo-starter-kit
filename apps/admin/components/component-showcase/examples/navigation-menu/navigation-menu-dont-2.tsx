import * as React from "react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";

export function NavigationMenuDont2Example(): React.JSX.Element {
	return (
		<NavigationMenu>
			<NavigationMenuList>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Billing</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="w-72">
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">Click here</div>
									</div>
								</NavigationMenuLink>
							</li>
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">More</div>
									</div>
								</NavigationMenuLink>
							</li>
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	);
}
