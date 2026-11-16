import BuildingIcon from "lucide-react-native/icons/building";
import ClapperboardIcon from "lucide-react-native/icons/clapperboard";
import GraduationCapIcon from "lucide-react-native/icons/graduation-cap";
import HeartPulseIcon from "lucide-react-native/icons/heart-pulse";
import LandmarkIcon from "lucide-react-native/icons/landmark";
import PlaneIcon from "lucide-react-native/icons/plane";
import StoreIcon from "lucide-react-native/icons/store";
import TruckIcon from "lucide-react-native/icons/truck";
import { Button } from "@workspace/ui-native/components/button";
import { NavigationMenu, type NavigationMenuItem } from "@workspace/ui-native/components/navigation-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const LEARN_MORE = <Button label="Learn more" variant="outline" onPress={ignorePress} />;

const ITEMS: readonly NavigationMenuItem[] = [
	{
		key: "industries",
		label: "Industries",
		columns: 2,
		footer: LEARN_MORE,
		links: [
			{ key: "retail", title: "Retail", description: "Stores and e-commerce.", icon: StoreIcon, onPress: ignorePress },
			{ key: "health", title: "Healthcare", description: "Clinics and care.", icon: HeartPulseIcon, onPress: ignorePress },
			{ key: "finance", title: "Finance", description: "Banks and fintech.", icon: LandmarkIcon, onPress: ignorePress },
			{ key: "education", title: "Education", description: "Schools and courses.", icon: GraduationCapIcon, onPress: ignorePress },
			{ key: "media", title: "Media", description: "Publishers and studios.", icon: ClapperboardIcon, onPress: ignorePress },
			{ key: "travel", title: "Travel", description: "Airlines and hotels.", icon: PlaneIcon, onPress: ignorePress },
			{ key: "logistics", title: "Logistics", description: "Shipping and fleets.", icon: TruckIcon, onPress: ignorePress },
			{ key: "public", title: "Public sector", description: "Government services.", icon: BuildingIcon, onPress: ignorePress },
		],
	},
];

export function NavigationMenu4Example(): React.JSX.Element {
	return <NavigationMenu items={ITEMS} />;
}
