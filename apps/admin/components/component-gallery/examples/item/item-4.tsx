import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@workspace/ui/components/item";
import { ChevronRightIcon, HistoryIcon, ShieldIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { ROUTES } from "@/lib/routes";

/** Each row is a real link into the admin app (reui's sample used `href="#"`). */
const PROFILE_LINK: React.JSX.Element = <Link href={ROUTES.account.profile} />;
const SECURITY_LINK: React.JSX.Element = <Link href={ROUTES.account.security} />;
const ACTIVITY_LINK: React.JSX.Element = <Link href={ROUTES.auditLogs.list} />;

export function Item4Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col">
			<ItemGroup className="gap-0">
				<Item render={PROFILE_LINK} size="xs">
					<ItemMedia variant="icon">
						<UserIcon />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Profile</ItemTitle>
						<ItemDescription>Manage your account details</ItemDescription>
					</ItemContent>
					<ItemActions>
						<ChevronRightIcon className="size-4 text-muted-foreground" />
					</ItemActions>
				</Item>
				<ItemSeparator />
				<Item render={SECURITY_LINK} size="xs">
					<ItemMedia variant="icon">
						<ShieldIcon />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Security</ItemTitle>
						<ItemDescription>Password and two-factor auth</ItemDescription>
					</ItemContent>
					<ItemActions>
						<ChevronRightIcon className="size-4 text-muted-foreground" />
					</ItemActions>
				</Item>
				<ItemSeparator />
				<Item render={ACTIVITY_LINK} size="xs">
					<ItemMedia variant="icon">
						<HistoryIcon />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Activity</ItemTitle>
						<ItemDescription>Requests and changes in the audit log</ItemDescription>
					</ItemContent>
					<ItemActions>
						<ChevronRightIcon className="size-4 text-muted-foreground" />
					</ItemActions>
				</Item>
			</ItemGroup>
		</div>
	);
}
