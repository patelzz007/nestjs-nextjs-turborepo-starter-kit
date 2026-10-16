import * as React from "react";
import {
	AppWindowIcon,
	AudioLinesIcon,
	BookOpenIcon,
	BrainIcon,
	GlobeIcon,
	ImageIcon,
	LayoutDashboardIcon,
	MicIcon,
	PaperclipIcon,
	PlusIcon,
	SearchIcon,
	ShoppingBagIcon,
	SparklesIcon,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup34Example(): React.JSX.Element {
	return (
		<Field className="max-w-3xl">
			<InputGroup className="h-14 rounded-full border bg-background p-1.5">
				<InputGroupAddon className="border-none pl-2">
					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="ghost" size="icon-sm" className="size-10 rounded-full text-muted-foreground hover:text-foreground" />}>
							<PlusIcon className="size-6" />
						</DropdownMenuTrigger>
						<DropdownMenuContent side="top" align="start" sideOffset={12} className="w-56">
							<DropdownMenuItem>
								<PaperclipIcon />
								<span>Add photos & files</span>
							</DropdownMenuItem>
							<DropdownMenuSeparator className="-mx-3" />
							<DropdownMenuItem>
								<ImageIcon />
								<span>Create image</span>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<BrainIcon />
								<span>Thinking</span>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<SearchIcon />
								<span>Deep research</span>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<ShoppingBagIcon />
								<span>Shopping research</span>
							</DropdownMenuItem>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<SparklesIcon />
									<span>More</span>
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent className="w-44">
									<DropdownMenuItem>
										<BookOpenIcon />
										<span>Study and learn</span>
									</DropdownMenuItem>
									<DropdownMenuItem>
										<GlobeIcon />
										<span>Web search</span>
									</DropdownMenuItem>
									<DropdownMenuItem>
										<LayoutDashboardIcon />
										<span>Canvas</span>
									</DropdownMenuItem>
									<DropdownMenuItem>
										<AppWindowIcon />
										<span>Explore apps</span>
									</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						</DropdownMenuContent>
					</DropdownMenu>
				</InputGroupAddon>

				<InputGroupInput placeholder="Ask anything" className="border-none px-2 text-lg shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0" />

				<InputGroupAddon align="inline-end" className="gap-2 border-none pr-1">
					<InputGroupButton variant="ghost" className="size-11 rounded-full text-muted-foreground hover:text-foreground">
						<MicIcon className="size-5" />
					</InputGroupButton>
					<InputGroupButton variant="default" className="size-11 rounded-full bg-black text-white hover:bg-black/90">
						<AudioLinesIcon className="size-5" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
