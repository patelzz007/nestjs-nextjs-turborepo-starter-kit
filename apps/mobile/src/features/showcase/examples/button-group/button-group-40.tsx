import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const SECTIONS: readonly string[] = ["Dashboard", "Projects", "Team", "Settings"];

export function ButtonGroup40Example(): React.JSX.Element {
	return (
		<ButtonGroup orientation="vertical" accessibilityLabel="Sections" className="self-stretch">
			{SECTIONS.map((section: string): React.JSX.Element => (
				<Button key={section} label={section} variant={section === "Dashboard" ? "secondary" : "outline"} onPress={ignorePress} className="justify-start" />
			))}
		</ButtonGroup>
	);
}
