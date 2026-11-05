// The app drawer (ADR 038): the (app) group's menu. Connects the presentational
// Drawer and drawer menu to the app — who is signed in, which screen is on
// show, the current appearance and app lock settings, where each destination
// goes, and signing out. Its entries come from mobile-drawer-items.json, filtered by the
// session's capabilities (drawer-destinations.ts); a branch folds open in place, nested up to
// six levels, and starts open when it holds the screen on show. Opened from the menu button in the corner of each
// tab's first screen, or by a swipe from the left edge there. Under the account
// header, the connection and session pills in full (the corner shows them
// compact).

import { usePathname } from "expo-router";
import LogOutIcon from "lucide-react-native/icons/log-out";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { Drawer } from "../../components/drawer";
import { DrawerAccountHeader, DrawerRow, DrawerSection, DrawerSubmenu } from "../../components/drawer-menu";
import { useApi } from "../../lib/api-context";
import { ROUTES, type AppRoute } from "../../runtime/routes";
import { useAppDrawerCommands, useAppDrawerOpen } from "../app-drawer/facade";
import { useBuildInfo } from "../build-info/use-build-info";
import { accountRowValue, useGithubPullRequestAccess } from "../../contexts/integrations-github";
import { NetworkStatusPill, SessionStatusPill } from "../app-status/status-pills";
import { SignOutDialog, useSignOutConfirmation } from "../../contexts/identity";
import { APP_LANGUAGE_NAMES } from "../language/app-languages";
import { useAppLanguage, useLabels } from "../language/use-app-language";
import { useAppLockEnabled, useThemePreference } from "../preferences/facade";
import { PREFERENCES_LABELS } from "../preferences/labels";
import { useOpenDestination } from "./use-open-destination";
import { NAVIGATION_LABELS, type NavigationLabels } from "./navigation-labels";
import { drawerHeadingOf, holdsScreen, isTabRoot, type DrawerBranch, type DrawerGroup, type DrawerNode, type DrawerScreen } from "./drawer-destinations";
import { useDrawerGroups } from "./use-drawer-groups";

export interface AppDrawerProps {
	/** The tabs. */
	readonly children: React.ReactNode;
}

export function AppDrawer({ children }: AppDrawerProps): React.JSX.Element {
	const isOpen = useAppDrawerOpen();
	const drawer = useAppDrawerCommands();
	const pathname = usePathname();
	return (
		<Drawer
			open={isOpen}
			onOpen={drawer.opened}
			onClose={drawer.closed}
			swipeEnabled={isTabRoot(pathname)}
			accessibilityLabel="Menu"
			closeLabel="Close menu"
			panel={<AppDrawerPanel />}
			testID="app-drawer">
			{children}
		</Drawer>
	);
}

function AppDrawerPanel(): React.JSX.Element {
	const api = useApi();
	const pathname = usePathname();
	const drawer = useAppDrawerCommands();
	const buildInfo = useBuildInfo();
	const theme = useThemePreference();
	const appLockEnabled = useAppLockEnabled();
	const language = useAppLanguage();
	const labels = useLabels(NAVIGATION_LABELS);
	const { themes } = useLabels(PREFERENCES_LABELS);
	const signOut = useSignOutConfirmation();
	const github = useGithubPullRequestAccess();
	const githubAccountValue = github.kind === "available" ? accountRowValue(github.account) : undefined;
	const me = api.auth.me.useQuery(undefined);
	const profile = api.auth.profile.useQuery(undefined);
	const user = me.data?.data;

	/** Closes the drawer and goes there: a tab is switched to, any other screen pushed onto its tab's stack. */
	const openDestination = useOpenDestination();
	const goTo = React.useCallback(
		(route: AppRoute, isTab: boolean): void => {
			drawer.closed();
			openDestination(route, isTab);
		},
		[drawer, openDestination],
	);
	const open = React.useCallback(
		(screen: DrawerScreen): void => {
			goTo(screen.route, screen.isTab);
		},
		[goTo],
	);
	// A branch the person folded or unfolded; any other starts open only when it holds the screen on show.
	const [foldedOpen, setFoldedOpen] = React.useState<ReadonlyMap<string, boolean>>(new Map());
	const isOpen = React.useCallback((branch: DrawerBranch): boolean => foldedOpen.get(branch.id) ?? holdsScreen(branch, pathname), [foldedOpen, pathname]);
	const toggle = React.useCallback(
		(branch: DrawerBranch): void => {
			setFoldedOpen((current: ReadonlyMap<string, boolean>): ReadonlyMap<string, boolean> =>
				new Map(current).set(branch.id, !(current.get(branch.id) ?? holdsScreen(branch, pathname))),
			);
		},
		[pathname],
	);
	const openProfile = React.useCallback((): void => {
		goTo(ROUTES.profile, true);
	}, [goTo]);

	/** The current setting a row shows on its right. */
	const valueOf = React.useCallback(
		(route: AppRoute): string | undefined => {
			if (route === ROUTES.appearance) {
				return themes[theme];
			}
			if (route === ROUTES.language) {
				return APP_LANGUAGE_NAMES[language];
			}
			if (route === ROUTES.appLock) {
				return appLockEnabled ? labels.settings.on : labels.settings.off;
			}
			if (route === ROUTES.githubAccount) {
				return githubAccountValue;
			}
			return undefined;
		},
		[appLockEnabled, githubAccountValue, labels, language, theme, themes],
	);
	const groups = useDrawerGroups();

	return (
		<View className="flex-1">
			<ScrollView contentContainerClassName="gap-5 pb-6">
				{user === undefined ? null : (
					<View className="px-4 pt-4 pb-1">
						<DrawerAccountHeader
							name={user.fullName}
							email={user.email}
							imageUrl={profile.data?.data.avatar?.url ?? null}
							action={{ label: labels.drawer.editProfile, onPress: openProfile }}
							testID="app-drawer-account"
						/>
					</View>
				)}
				<View className="flex-row flex-wrap gap-2 px-4" testID="app-drawer-status">
					<NetworkStatusPill testID="app-drawer-network" />
					<SessionStatusPill testID="app-drawer-session" />
				</View>
				{groups.map((group: DrawerGroup): React.JSX.Element => (
					<DrawerSection key={group.key} {...(group.heading === null ? {} : { heading: { title: labels.sections[group.heading.section], tone: group.heading.tone } })}>
						<DrawerNodeRows nodes={group.nodes} pathname={pathname} labels={labels} valueOf={valueOf} isOpen={isOpen} onToggle={toggle} onOpen={open} />
					</DrawerSection>
				))}
				<DrawerSection>
					<DrawerRow icon={LogOutIcon} label={labels.drawer.signOut} tone="destructive" onPress={signOut.ask} testID="app-drawer-sign-out" />
				</DrawerSection>
				<View className="gap-0.5 px-6 pt-2" testID="app-drawer-build">
					<Text className="font-sans text-xs text-muted-foreground">{buildInfo.summary}</Text>
					{buildInfo.moment === null ? null : <Text className="font-sans text-xs text-muted-foreground">{buildInfo.moment.line}</Text>}
				</View>
			</ScrollView>
			<SignOutDialog confirmation={signOut} />
		</View>
	);
}

interface DrawerNodeRowsProps {
	readonly nodes: readonly DrawerNode[];
	readonly pathname: string;
	/** The navigation's words in the language on screen: a screen's row is labelled with its heading's title. */
	readonly labels: NavigationLabels;
	/** The current setting a screen's row shows on its right. */
	readonly valueOf: (route: AppRoute) => string | undefined;
	readonly isOpen: (branch: DrawerBranch) => boolean;
	readonly onToggle: (branch: DrawerBranch) => void;
	readonly onOpen: (screen: DrawerScreen) => void;
}

/** The rows of `nodes`: a screen's row opens it; a branch's row folds its rows open or shut, in a submenu one step in. */
function DrawerNodeRows({ nodes, pathname, labels, valueOf, isOpen, onToggle, onOpen }: DrawerNodeRowsProps): React.JSX.Element {
	return (
		<>
			{nodes.map((node: DrawerNode): React.JSX.Element =>
				node.kind === "screen" ? (
					<ScreenRow key={node.id} screen={node} label={drawerHeadingOf(node, labels).title} value={valueOf(node.route)} selected={node.route === pathname} onOpen={onOpen} />
				) : (
					<React.Fragment key={node.id}>
						<BranchRow branch={node} label={drawerHeadingOf(node, labels).title} open={isOpen(node)} onToggle={onToggle} />
						{isOpen(node) ? (
							<DrawerSubmenu testID={`app-drawer-${node.labelKey}-rows`}>
								<DrawerNodeRows nodes={node.children} pathname={pathname} labels={labels} valueOf={valueOf} isOpen={isOpen} onToggle={onToggle} onOpen={onOpen} />
							</DrawerSubmenu>
						) : null}
					</React.Fragment>
				),
			)}
		</>
	);
}

interface ScreenRowProps {
	readonly screen: DrawerScreen;
	readonly label: string;
	readonly value: string | undefined;
	readonly selected: boolean;
	readonly onOpen: (screen: DrawerScreen) => void;
}

function ScreenRow({ screen, label, value, selected, onOpen }: ScreenRowProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onOpen(screen);
	}, [onOpen, screen]);
	return (
		<DrawerRow icon={screen.icon} label={label} selected={selected} onPress={press} testID={`app-drawer-${screen.labelKey}`} {...(value === undefined ? {} : { value })} />
	);
}

interface BranchRowProps {
	readonly branch: DrawerBranch;
	readonly label: string;
	readonly open: boolean;
	readonly onToggle: (branch: DrawerBranch) => void;
}

function BranchRow({ branch, label, open, onToggle }: BranchRowProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onToggle(branch);
	}, [branch, onToggle]);
	return <DrawerRow icon={branch.icon} label={label} expanded={open} onPress={press} testID={`app-drawer-${branch.labelKey}`} />;
}
