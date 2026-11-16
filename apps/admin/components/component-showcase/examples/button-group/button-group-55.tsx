import * as React from "react";
import { CalendarIcon, CheckIcon, ChevronDownIcon, CreditCardIcon, FileTextIcon, XIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

export function ButtonGroup55Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<ButtonGroup>
				<ButtonGroupText className="gap-1.5 border border-input bg-muted/40 px-2.5 text-xs text-muted-foreground">
					<CreditCardIcon className="size-3.5 opacity-60" aria-hidden="true" />
					<span className="font-medium text-foreground tabular-nums">USD 12,480</span>
				</ButtonGroupText>
				<Button variant="outline" size="sm">
					Hold
				</Button>
			</ButtonGroup>

			<ButtonGroup className="**:data-[slot=button]:border-r-0">
				<Button size="sm">
					<CheckIcon aria-hidden="true" />
					Release
				</Button>
				<ButtonGroupSeparator className="bg-primary/72" />
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button size="icon-sm" className="rounded-l-none border-l border-primary-foreground/20" aria-label="More payout actions" />}>
						<ChevronDownIcon aria-hidden="true" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" sideOffset={8} className="w-44">
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<CalendarIcon className="size-4 opacity-60" aria-hidden="true" />
								Schedule for Friday
							</DropdownMenuItem>
							<DropdownMenuItem>
								<CreditCardIcon className="size-4 opacity-60" aria-hidden="true" />
								Change destination
							</DropdownMenuItem>
							<DropdownMenuItem>
								<FileTextIcon className="size-4 opacity-60" aria-hidden="true" />
								Export receipt
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive">
								<XIcon aria-hidden="true" />
								Cancel payout
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
		</div>
	);
}
