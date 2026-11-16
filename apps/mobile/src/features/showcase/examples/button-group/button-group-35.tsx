import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

const PAGES: readonly number[] = [1, 2, 3, 4, 5];
const CURRENT = 3;

export function ButtonGroup35Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Pages" className="self-start">
			<IconButton icon={ChevronLeftIcon} label="Previous page" onPress={ignorePress} />
			{PAGES.map((page: number): React.JSX.Element => (
				<Button
					key={page}
					label={String(page)}
					variant={page === CURRENT ? "primary" : "outline"}
					accessibilityLabel={page === CURRENT ? `Page ${String(page)}, current` : `Page ${String(page)}`}
					onPress={ignorePress}
					className="w-12 px-0"
				/>
			))}
			<IconButton icon={ChevronRightIcon} label="Next page" onPress={ignorePress} />
		</ButtonGroup>
	);
}
