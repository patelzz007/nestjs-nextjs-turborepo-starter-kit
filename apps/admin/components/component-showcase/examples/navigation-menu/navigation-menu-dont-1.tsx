import * as React from "react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";

export function NavigationMenuDont1Example(): React.JSX.Element {
	return (
		<NavigationMenu>
			<NavigationMenuList>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Invoices</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="w-72">
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">Invoices home</div>
									</div>
								</NavigationMenuLink>
							</li>
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Payments</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="w-72">
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">Payments home</div>
									</div>
								</NavigationMenuLink>
							</li>
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Plans</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="w-72">
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">Plans home</div>
									</div>
								</NavigationMenuLink>
							</li>
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Taxes</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="w-72">
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">Taxes home</div>
									</div>
								</NavigationMenuLink>
							</li>
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Receipts</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="w-72">
							<li>
								<NavigationMenuLink href="#component-navigation-menu">
									<div className="flex flex-col gap-1 px-1">
										<div className="font-medium">Receipts home</div>
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
