import * as React from "react";
import { DatabaseIcon, InboxIcon, UserPlusIcon } from "lucide-react";
import { IconStack } from "@workspace/ui/components/icon-stack";

import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function IconStack5Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center p-4">
			<Empty className="max-w-md py-10">
				<EmptyHeader>
					<EmptyMedia>
						<IconStack aria-hidden="true" className="h-24 w-22 text-primary">
							<InboxIcon className="size-5 text-primary" />
						</IconStack>
					</EmptyMedia>
					<EmptyTitle>Workspace is ready</EmptyTitle>
					<EmptyDescription>Invite teammates or connect a data source to start filling this view.</EmptyDescription>
				</EmptyHeader>

				<EmptyContent className="flex-row justify-center gap-2">
					<Button size="sm">
						<UserPlusIcon data-icon="inline-start" />
						Invite team
					</Button>
					<Button variant="outline" size="sm">
						<DatabaseIcon data-icon="inline-start" />
						Connect source
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
