import * as React from "react";
import { CheckIcon, ChevronDownIcon, ExternalLinkIcon, GitBranchIcon, GitMergeIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

export function ButtonGroup7Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" className="gap-2">
							<GitMergeIcon aria-hidden="true" />
							<span>main</span>
							<ChevronDownIcon aria-hidden="true" className="size-3.5 opacity-60" />
						</Button>
					}
				/>
				<DropdownMenuContent align="start" className="w-48">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
						<DropdownMenuItem>
							<GitBranchIcon aria-hidden="true" />
							<span>main</span>
							<CheckIcon aria-hidden="true" className="ml-auto size-3.5 text-primary" />
						</DropdownMenuItem>
						<DropdownMenuItem>
							<GitBranchIcon aria-hidden="true" />
							<span>develop</span>
						</DropdownMenuItem>
						<DropdownMenuItem>
							<GitBranchIcon aria-hidden="true" />
							<span>feature/auth</span>
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<ButtonGroupText className="bg-transparent">
				<div className="size-1.5 animate-pulse rounded-full bg-success" />
				<span>Production</span>
			</ButtonGroupText>

			<Button variant="outline" size="icon" aria-label="Refresh">
				<RefreshCwIcon aria-hidden="true" />
			</Button>

			<Button variant="outline" size="icon" aria-label="Open in new tab">
				<ExternalLinkIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
