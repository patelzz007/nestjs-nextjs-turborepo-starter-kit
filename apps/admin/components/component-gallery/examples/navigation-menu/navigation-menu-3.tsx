import * as React from "react";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";

export function NavigationMenu3Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuTrigger>Status</NavigationMenuTrigger>
						<NavigationMenuContent>
							<ul className="grid w-[200px] gap-2">
								<li>
									<NavigationMenuLink href="#component-navigation-menu" className="flex items-center gap-2">
										<CircleAlertIcon />
										Backlog
									</NavigationMenuLink>
								</li>
								<li>
									<NavigationMenuLink href="#component-navigation-menu" className="flex items-center gap-2">
										<CircleCheckIcon />
										Done
									</NavigationMenuLink>
								</li>
							</ul>
						</NavigationMenuContent>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
		</div>
	);
}
