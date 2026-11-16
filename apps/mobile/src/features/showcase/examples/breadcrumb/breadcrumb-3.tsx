import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import { useRouter } from "expo-router";
import * as React from "react";

export function Breadcrumb3Example(): React.JSX.Element {
	const router = useRouter();
	const items = React.useMemo(
		(): readonly BreadcrumbItemData[] => [
			{
				key: "home",
				label: "Home",
				onPress: (): void => {
					router.navigate("/");
				},
			},
			{
				key: "settings",
				label: "Settings",
				onPress: (): void => {
					router.navigate("/settings");
				},
			},
			{ key: "profile", label: "Profile" },
		],
		[router],
	);
	return <Breadcrumb items={items} />;
}
