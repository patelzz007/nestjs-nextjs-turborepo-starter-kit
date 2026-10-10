// ============================================
// Search — the starter shell's placeholder for a search feature
// ============================================
// The tab exists so the navigation is complete; there is nothing to search
// yet. A product replaces this screen with its own search: a search field and
// a results list fed from the product's own data source (apps/mobile/README.md,
// "Search").

import { useRouter } from "expo-router";
import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";

import { ComingSoon } from "../../components/coming-soon";
import { Screen } from "../../components/screen";
import { ROUTES } from "../../runtime/routes";

export default function SearchScreen(): React.JSX.Element {
	const router = useRouter();

	const goHome = React.useCallback((): void => {
		// Switches to the Home tab instead of stacking another screen on Search.
		router.navigate(ROUTES.home);
	}, [router]);

	return (
		<Screen>
			<ComingSoon
				icon={SearchIcon}
				title="Search is coming soon"
				description="Soon you'll be able to find anything in the app from here."
				action={{ label: "Back to home", onPress: goHome, accessibilityHint: "Opens the Home tab" }}
				testID="search-coming-soon"
			/>
		</Screen>
	);
}
