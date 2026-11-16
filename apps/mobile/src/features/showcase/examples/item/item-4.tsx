import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@workspace/ui-native/components/item";
import { type Href, useRouter } from "expo-router";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import HistoryIcon from "lucide-react-native/icons/history";
import ShieldIcon from "lucide-react-native/icons/shield";
import UserIcon from "lucide-react-native/icons/user";
import * as React from "react";

interface NavigationRow {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description: string;
	readonly href: Href;
}

/** Each row is a real link into the app. */
const ROWS: readonly NavigationRow[] = [
	{ icon: UserIcon, title: "Profile", description: "Manage your account details", href: "/profile" },
	{ icon: ShieldIcon, title: "Security", description: "Password and two-factor auth", href: "/settings/security" },
	{ icon: HistoryIcon, title: "Devices", description: "Where you are signed in", href: "/settings/devices" },
];

function NavigationItem({ row }: { readonly row: NavigationRow }): React.JSX.Element {
	const router = useRouter();
	const open = React.useCallback((): void => {
		router.navigate(row.href);
	}, [router, row.href]);
	return (
		<Item size="xs" onPress={open} accessibilityLabel={`${row.title}, ${row.description}`}>
			<ItemMedia variant="icon">
				<Icon icon={row.icon} size="sm" colorClassName="accent-foreground" />
			</ItemMedia>
			<ItemContent>
				<ItemTitle>{row.title}</ItemTitle>
				<ItemDescription>{row.description}</ItemDescription>
			</ItemContent>
			<ItemActions>
				<Icon icon={ChevronRightIcon} size="sm" colorClassName="accent-muted-foreground" />
			</ItemActions>
		</Item>
	);
}

export function Item4Example(): React.JSX.Element {
	return (
		<ItemGroup className="gap-0">
			{ROWS.map((row: NavigationRow, position: number): React.JSX.Element => (
				<React.Fragment key={row.title}>
					{position === 0 ? null : <ItemSeparator />}
					<NavigationItem row={row} />
				</React.Fragment>
			))}
		</ItemGroup>
	);
}
