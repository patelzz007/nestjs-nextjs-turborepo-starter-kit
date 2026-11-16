import Link from "next/link";
import * as React from "react";
import { BuildingIcon, CircleDollarSignIcon, LayoutGridIcon, RadioIcon, SparklesIcon, UserIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";

const industries = [
	{
		title: "Individuals",
		description: "Keep your finances organized.",
		href: "#component-navigation-menu",
		icon: <UserIcon />,
	},
	{
		title: "LLCs",
		description: "Benefit from tax write-offs.",
		href: "#component-navigation-menu",
		icon: <BuildingIcon />,
	},
	{
		title: "Freelancers",
		description: "For independent workers.",
		href: "#component-navigation-menu",
		icon: <CircleDollarSignIcon />,
	},
	{
		title: "Investors",
		description: "Make and grow your money.",
		href: "#component-navigation-menu",
		icon: <LayoutGridIcon />,
	},
	{
		title: "Small businesses",
		description: "We take care of your taxes.",
		href: "#component-navigation-menu",
		icon: <SparklesIcon />,
	},
	{
		title: "Crypto",
		description: "For tech enthusiasts.",
		href: "#component-navigation-menu",
		icon: <CircleDollarSignIcon />,
	},
	{
		title: "Big companies",
		description: "Run your finances easily.",
		href: "#component-navigation-menu",
		icon: <BuildingIcon />,
	},
	{
		title: "Investments",
		description: "Launch your ideas worldwide.",
		href: "#component-navigation-menu",
		icon: <RadioIcon />,
	},
];

export function NavigationMenu4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuTrigger>Industries</NavigationMenuTrigger>
						<NavigationMenuContent>
							<div className="w-[500px]">
								<ul className="grid grid-cols-2 gap-1">
									{industries.map((item) => (
										<li key={item.title}>
											<NavigationMenuLink href="#component-navigation-menu" className="flex items-start gap-2 p-3">
												{item.icon}
												<div className="flex flex-col gap-0.5">
													<div className="text-sm leading-none font-medium">{item.title}</div>
													<p className="text-xs leading-snug text-muted-foreground">{item.description}</p>
												</div>
											</NavigationMenuLink>
										</li>
									))}
								</ul>
								<div className="mt-2 px-1 pb-1">
									<Button className="w-full" nativeButton={false} render={<Link href="#component-navigation-menu" />}>
										Learn more
									</Button>
								</div>
							</div>
						</NavigationMenuContent>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
		</div>
	);
}
