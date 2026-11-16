import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@workspace/ui/components/drawer";
import { Input } from "@workspace/ui/components/input";

const CHECKOUT_FIELDS: readonly string[] = [
	"Full name",
	"Email",
	"Phone",
	"Street",
	"City",
	"Postcode",
	"Country",
	"Card number",
	"Expiry",
	"Security code",
	"Billing street",
	"Billing city",
];

export function DrawerDont2Example(): React.JSX.Element {
	return (
		<Drawer showSwipeHandle>
			<DrawerTrigger render={<Button variant="outline">Checkout</Button>} />
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>Checkout</DrawerTitle>
					<DrawerDescription>Shipping, billing and payment.</DrawerDescription>
				</DrawerHeader>
				<div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-4">
					{CHECKOUT_FIELDS.map((field: string): React.JSX.Element => (
						<Input key={field} aria-label={field} placeholder={field} />
					))}
				</div>
				<DrawerFooter>
					<DrawerClose render={<Button>Done</Button>} />
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
