// A section's navigation (the web kit's `NavigationMenu`): a row of links,
// some of them groups that open a panel of their own links — each with a
// title, a line under it and a glyph — in one or two columns, with an
// optional footer (a Learn more button). On a phone a group's panel rises in
// a bottom sheet; a plain link goes straight where it points.
//
// Data-agnostic: `items` in; every link's `onPress` is the caller's
// navigation. The ref reaches the row.

import { cva } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import * as React from "react";
import { Pressable, ScrollView, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { BottomSheet } from "./bottom-sheet";
import { Icon, type LucideIcon } from "./icon";

export interface NavigationMenuLink {
	readonly key: string;
	readonly title: string;
	readonly description?: string | undefined;
	readonly icon?: LucideIcon | undefined;
	readonly onPress: () => void;
}

export interface NavigationMenuItem {
	readonly key: string;
	readonly label: string;
	/** A plain link: goes straight where it points. */
	readonly onPress?: (() => void) | undefined;
	/** A group: opens a panel of these links. */
	readonly links?: readonly NavigationMenuLink[] | undefined;
	/** The panel's columns. Default 1. */
	readonly columns?: 1 | 2 | undefined;
	/** Under the panel's links: a Learn more button. */
	readonly footer?: React.ReactNode;
}

export const navigationMenuTriggerVariants = cva("h-10 flex-row items-center gap-1 rounded-lg px-3", {
	variants: {
		open: { true: "bg-muted", false: "active:bg-muted" },
	},
	defaultVariants: { open: false },
});

const navigationMenuLinkVariants = cva("gap-1 rounded-lg p-3 active:bg-muted", {
	variants: {
		columns: { 1: "w-full", 2: "w-1/2" },
	},
	defaultVariants: { columns: 1 },
});

export interface NavigationMenuProps {
	readonly items: readonly NavigationMenuItem[];
	/** The row's name for screen readers. Default "Main". */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the row, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface PanelLinkProps {
	readonly link: NavigationMenuLink;
	readonly columns: 1 | 2;
	readonly onDone: () => void;
}

function PanelLink({ link, columns, onDone }: PanelLinkProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onDone();
		link.onPress();
	}, [link, onDone]);
	return (
		<Pressable
			accessibilityRole="link"
			accessibilityLabel={link.description === undefined ? link.title : `${link.title}, ${link.description}`}
			onPress={press}
			className={navigationMenuLinkVariants({ columns })}>
			<View className="flex-row items-center gap-2">
				{link.icon === undefined ? null : <Icon icon={link.icon} size="sm" colorClassName="accent-icon" />}
				<Text className="text-body font-sans-semibold text-foreground">{link.title}</Text>
			</View>
			{link.description === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{link.description}</Text>}
		</Pressable>
	);
}

interface TriggerProps {
	readonly item: NavigationMenuItem;
	readonly open: boolean;
	readonly onOpen: (key: string) => void;
}

function Trigger({ item, open, onOpen }: TriggerProps): React.JSX.Element {
	const isGroup = item.links !== undefined;
	const press = React.useCallback((): void => {
		if (isGroup) {
			onOpen(item.key);
			return;
		}
		item.onPress?.();
	}, [isGroup, item, onOpen]);
	const accessibilityState = React.useMemo(() => ({ expanded: isGroup ? open : undefined }), [isGroup, open]);
	return (
		<Pressable
			accessibilityRole={isGroup ? "button" : "link"}
			accessibilityLabel={item.label}
			accessibilityState={accessibilityState}
			onPress={press}
			className={navigationMenuTriggerVariants({ open })}>
			<Text className="text-body font-sans-medium text-foreground">{item.label}</Text>
			{isGroup ? <Icon icon={ChevronDownIcon} size="sm" colorClassName="accent-icon" /> : null}
		</Pressable>
	);
}

export const NavigationMenu = React.memo(
	React.forwardRef<ViewInstance, NavigationMenuProps>(function NavigationMenu({ items, accessibilityLabel = "Main", className, testID }, ref): React.JSX.Element {
		const [openKey, setOpenKey] = React.useState<string | null>(null);
		const close = React.useCallback((): void => {
			setOpenKey(null);
		}, []);
		const group = items.find((item: NavigationMenuItem): boolean => item.key === openKey);
		const columns = group?.columns ?? 1;
		return (
			<View ref={ref} accessibilityRole="menubar" accessibilityLabel={accessibilityLabel} testID={testID} className={cn("flex-row", className)}>
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-1">
					{items.map((item: NavigationMenuItem): React.JSX.Element => (
						<Trigger key={item.key} item={item} open={item.key === openKey} onOpen={setOpenKey} />
					))}
				</ScrollView>
				<BottomSheet visible={group !== undefined} title={group?.label ?? ""} onClose={close} testID={testID === undefined ? undefined : `${testID}-panel`}>
					<View className="flex-row flex-wrap">
						{(group?.links ?? []).map((link: NavigationMenuLink): React.JSX.Element => (
							<PanelLink key={link.key} link={link} columns={columns} onDone={close} />
						))}
					</View>
					{group?.footer ?? null}
				</BottomSheet>
			</View>
		);
	}),
);
