import * as React from "react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";

const components = [
	{
		title: "Alert Dialog",
		href: "#component-navigation-menu",
		description: "A modal dialog that interrupts the user with important content.",
	},
	{
		title: "Hover Card",
		href: "#component-navigation-menu",
		description: "For sighted users to preview content available behind a link.",
	},
	{
		title: "Progress",
		href: "#component-navigation-menu",
		description: "Displays an indicator showing the completion progress of a task.",
	},
	{
		title: "Scroll-area",
		href: "#component-navigation-menu",
		description: "Visually or semantically separates content.",
	},
];

export function NavigationMenu2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuTrigger>Components</NavigationMenuTrigger>
						<NavigationMenuContent>
							<ul className="grid w-[400px] gap-2 md:w-[500px] md:grid-cols-2">
								{components.map((component) => (
									<li key={component.title}>
										<NavigationMenuLink href={component.href} className="flex flex-col items-start gap-2 p-3">
											<div className="text-sm leading-none font-medium">{component.title}</div>
											<p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{component.description}</p>
										</NavigationMenuLink>
									</li>
								))}
							</ul>
						</NavigationMenuContent>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
		</div>
	);
}
