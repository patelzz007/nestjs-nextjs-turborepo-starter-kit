import * as React from "react";
import { CircleDashedIcon } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Kbd } from "@workspace/ui/components/kbd";

export function Empty3Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Empty className="border">
				<EmptyHeader>
					<EmptyTitle>404 — Not Found</EmptyTitle>
					<EmptyDescription>The page you&apos;re looking for doesn&apos;t exist. Try searching for what you need below.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<InputGroup className="w-3/4">
						<InputGroupInput placeholder="Try searching for pages…" />
						<InputGroupAddon>
							<CircleDashedIcon />
						</InputGroupAddon>
						<InputGroupAddon align="inline-end">
							<Kbd>/</Kbd>
						</InputGroupAddon>
					</InputGroup>
					<EmptyDescription>
						Need help? <a href="mailto:support@example.com">Contact support</a>
					</EmptyDescription>
				</EmptyContent>
			</Empty>
		</div>
	);
}
