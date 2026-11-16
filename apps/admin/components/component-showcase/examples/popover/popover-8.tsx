import Image from "next/image";
import * as React from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

/** A sample preview from images.unsplash.com (the host `next.config` allows). */
const PREVIEW_WIDTH = 320;
const PREVIEW_HEIGHT = 180;
const PREVIEW_SRC = `https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=${String(PREVIEW_WIDTH)}&h=${String(PREVIEW_HEIGHT)}&q=80`;

export function Popover8Example(): React.JSX.Element {
	return (
		<div className="flex min-h-[100px] items-center justify-center">
			<Popover>
				<PopoverTrigger
					render={
						<Button variant="outline" size="sm">
							Preview Media
						</Button>
					}
				/>
				<PopoverContent className="w-[320px] gap-0 overflow-hidden p-0" align="end">
					<div className="aspect-video w-full overflow-hidden bg-muted">
						<Image
							src={PREVIEW_SRC}
							alt="Website Template Preview"
							width={PREVIEW_WIDTH}
							height={PREVIEW_HEIGHT}
							className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
						/>
					</div>
					<div className="space-y-3 p-2">
						<div className="space-y-1 pt-1">
							<h4 className="text-sm leading-none font-semibold">Portfolio Pro</h4>
							<p className="text-xs text-muted-foreground">Premium photography template with dark mode.</p>
						</div>
						<div className="grid grid-cols-2 items-center gap-2">
							<Button size="sm" className="flex-1">
								Install Template
							</Button>
							<Button size="sm" variant="outline" aria-label="View demo in new tab">
								Learn more
								<ExternalLinkIcon />
							</Button>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
