import * as React from "react";
import { PackageIcon } from "lucide-react";
import { IconStack } from "@workspace/ui/components/icon-stack";

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

export function IconStack6Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md items-center justify-center p-4">
			<Item variant="outline" className="max-w-sm">
				<ItemMedia>
					<IconStack aria-hidden="true" className="h-12 w-11 text-primary">
						<PackageIcon className="size-3 text-primary" />
					</IconStack>
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Registry package ready</ItemTitle>
					<ItemDescription>Use IconStack as rich media inside compact shadcn items.</ItemDescription>
				</ItemContent>
			</Item>
		</div>
	);
}
