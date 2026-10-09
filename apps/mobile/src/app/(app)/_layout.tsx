// The (app) group: tabs — Home, Profile, Settings (§9.2). Reachable only with a
// full session (the root guard).

import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import * as React from "react";
import type { ColorValue } from "react-native";

import { useNavigationColors } from "../../lib/theme-colors";

interface TabIconProps {
	readonly color: ColorValue;
	readonly size: number;
}

function HomeIcon({ color, size }: TabIconProps): React.JSX.Element {
	return <Ionicons name="home-outline" color={color} size={size} />;
}

function ProfileIcon({ color, size }: TabIconProps): React.JSX.Element {
	return <Ionicons name="person-outline" color={color} size={size} />;
}

function SettingsIcon({ color, size }: TabIconProps): React.JSX.Element {
	return <Ionicons name="settings-outline" color={color} size={size} />;
}

export default function AppTabsLayout(): React.JSX.Element {
	const colors = useNavigationColors();
	const screenOptions = React.useMemo(
		(): React.ComponentProps<typeof Tabs>["screenOptions"] => ({
			headerShown: false,
			// A colour the theme has not resolved yet falls back to the navigator's default.
			...(colors.active === undefined ? {} : { tabBarActiveTintColor: colors.active }),
			...(colors.inactive === undefined ? {} : { tabBarInactiveTintColor: colors.inactive }),
			tabBarStyle: {
				...(colors.background === undefined ? {} : { backgroundColor: colors.background }),
				...(colors.border === undefined ? {} : { borderTopColor: colors.border }),
			},
		}),
		[colors.active, colors.background, colors.border, colors.inactive],
	);
	return (
		<Tabs screenOptions={screenOptions}>
			<Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: HomeIcon }} />
			<Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ProfileIcon }} />
			<Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: SettingsIcon }} />
		</Tabs>
	);
}
