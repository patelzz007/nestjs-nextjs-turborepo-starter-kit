import * as React from "react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from "@workspace/ui/components/navigation-menu";

export function NavigationMenu1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
						<NavigationMenuContent>
							<ul className="w-80">
								<li>
									<NavigationMenuLink href="#component-navigation-menu">
										<div className="flex flex-col gap-1 px-1">
											<div className="font-medium">Introduction</div>
											<div className="line-clamp-2 text-sm text-muted-foreground">Re-usable components built with Tailwind CSS.</div>
										</div>
									</NavigationMenuLink>
								</li>
								<li>
									<NavigationMenuLink href="#component-navigation-menu">
										<div className="flex flex-col gap-1 px-1">
											<div className="font-medium">Installation</div>
											<div className="line-clamp-2 text-sm text-muted-foreground">How to install dependencies and structure your app.</div>
										</div>
									</NavigationMenuLink>
								</li>
							</ul>
						</NavigationMenuContent>
					</NavigationMenuItem>
					<NavigationMenuItem>
						<NavigationMenuLink href="#component-navigation-menu" className={navigationMenuTriggerStyle()}>
							Documentation
						</NavigationMenuLink>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
		</div>
	);
}
