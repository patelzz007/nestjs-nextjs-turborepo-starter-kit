import * as React from "react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";

export function NavigationMenuDo1Example(): React.JSX.Element {
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
										<div className="font-medium">Invoices</div>
										<div className="text-sm text-muted-foreground">Every invoice, paid and due.</div>
									</div>
								</NavigationMenuLink>
							</li>
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">Payment methods</div>
										<div className="text-sm text-muted-foreground">Cards and bank accounts on file.</div>
									</div>
								</NavigationMenuLink>
							</li>
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">Plans</div>
										<div className="text-sm text-muted-foreground">Compare plans and switch.</div>
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
