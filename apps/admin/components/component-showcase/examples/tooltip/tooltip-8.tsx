import * as React from "react";
import { BoldIcon, ImageIcon, ItalicIcon, UnderlineIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip8Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<TooltipProvider>
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Bold" />}>
							<BoldIcon aria-hidden="true" />
						</TooltipTrigger>
						<TooltipContent>Bold</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Italic" />}>
							<ItalicIcon aria-hidden="true" />
						</TooltipTrigger>
						<TooltipContent>Italic</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Underline" />}>
							<UnderlineIcon aria-hidden="true" />
						</TooltipTrigger>
						<TooltipContent>Underline</TooltipContent>
					</Tooltip>
					<div className="flex items-center">
						<Separator orientation="vertical" className="mx-1 h-5 leading-none" />
					</div>
					<Tooltip>
						<TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Image" />}>
							<ImageIcon aria-hidden="true" />
						</TooltipTrigger>
						<TooltipContent>Insert Image</TooltipContent>
					</Tooltip>
				</div>
			</TooltipProvider>
		</div>
	);
}
