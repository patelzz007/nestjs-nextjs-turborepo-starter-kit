import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";

export function Collapsible3Example(): React.JSX.Element {
	return (
		<div className="h-40 w-full max-w-xs">
			<Card className="py-3">
				<CardContent className="px-3">
					<Collapsible>
						<CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-sm">
							<span>How do I reset my password?</span>
							<ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform in-aria-expanded:rotate-180" />
						</CollapsibleTrigger>
						<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
							<div className="pt-3 text-sm text-muted-foreground">
								You can reset your password by clicking the &quot;Forgot Password&quot; link on the login page. We&apos;ll send you an email with instructions to create a new
								password.
							</div>
						</CollapsibleContent>
					</Collapsible>
				</CardContent>
			</Card>
		</div>
	);
}
