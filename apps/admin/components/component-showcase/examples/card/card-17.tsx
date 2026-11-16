import * as React from "react";
import { ChevronRightIcon, ShoppingBagIcon } from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";

const item = {
	title: "Recent Orders Overview",
	description: "Track and review all recent purchases, updates, and status changes in one place.",
	link: "View Orders",
	icon: <ShoppingBagIcon aria-hidden="true" />,
};

export function Card17Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardContent className="flex flex-col gap-3">
				<div className="flex size-11 items-center justify-center rounded-md bg-primary [&_svg]:size-5 [&_svg]:text-primary-foreground">{item.icon}</div>
				<a href="#component-card" className="block text-sm leading-tight font-medium text-foreground hover:text-primary">
					{item.title}
				</a>
				<p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
				<a href="#component-card" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
					{item.link}
					<ChevronRightIcon aria-hidden="true" className="size-2.5 shrink-0" />
				</a>
			</CardContent>
		</Card>
	);
}
