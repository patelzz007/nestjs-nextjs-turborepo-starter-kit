import { Scrollspy, type ScrollspySection } from "@workspace/ui-native/components/scrollspy";
import * as React from "react";
import { Text } from "react-native";

const PARAGRAPH =
	"The kit's components are built for phones first: thumb reach, 44 pt targets, and screen readers. Each one is controlled, typed and tested, and takes its look from tokens so a theme changes everything at once. Scroll on to see the links follow.";
const SECTIONS: readonly ScrollspySection[] = ["Overview", "Install", "Usage", "Theming", "FAQ"].map((label: string): ScrollspySection => ({
	key: label.toLowerCase(),
	label,
	content: <Text className="text-body font-sans text-muted-foreground">{`${label}: ${PARAGRAPH}`}</Text>,
}));

export function ScrollspyDo2Example(): React.JSX.Element {
	return <Scrollspy sections={SECTIONS} navigation="horizontal" panelClassName="h-80" />;
}
