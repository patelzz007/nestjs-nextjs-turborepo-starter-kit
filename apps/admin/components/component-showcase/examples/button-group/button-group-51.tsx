import type * as React from "react";
import { FileTextIcon, MoreHorizontalIcon, PlusIcon, ShoppingCartIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

const icons = {
	plus: <PlusIcon aria-hidden="true" />,
	more: <MoreHorizontalIcon aria-hidden="true" />,
	userPlus: <UserPlusIcon aria-hidden="true" />,
	cart: <ShoppingCartIcon aria-hidden="true" />,
	fileText: <FileTextIcon aria-hidden="true" />,
};

export function ButtonGroup51Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="sm">
				{icons.plus}
				New
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button size="icon-sm" variant="outline" aria-label="More create options">
							{icons.more}
						</Button>
					}
				/>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Create</DropdownMenuLabel>
						<DropdownMenuItem>
							{icons.userPlus}
							New Customer
						</DropdownMenuItem>
						<DropdownMenuItem>
							{icons.cart}
							New Order
						</DropdownMenuItem>
						<DropdownMenuItem>
							{icons.fileText}
							New Invoice
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
