import * as React from "react";
import { InfoIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Label7Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-tooltip" className="gap-1">
				API Key
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger className="inline-flex items-center">
							<span className="inline-flex cursor-help text-muted-foreground">
								<InfoIcon className="size-3.5" />
							</span>
						</TooltipTrigger>
						<TooltipContent>
							<p>Your API key can be found in the developer settings.</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</Label>
			<Input id="label-tooltip" placeholder="sk_live_..." className="font-mono" />
		</Field>
	);
}
