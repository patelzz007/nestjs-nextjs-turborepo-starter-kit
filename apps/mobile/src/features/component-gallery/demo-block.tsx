// The Components screen's building block: one kit component (or one family),
// its name and a line on what it is for, then live examples. Smart-side layout
// for the gallery only — the examples own their demo state; the kit components
// inside stay controlled.

import { Card } from "@workspace/ui-native/components/card";
import * as React from "react";
import { View } from "react-native";

export interface DemoBlockProps {
	/** The component's name as the kit exports it ("Button"). */
	readonly title: string;
	/** What it is for, in one line. */
	readonly description: string;
	readonly children: React.ReactNode;
}

export function DemoBlock({ title, description, children }: DemoBlockProps): React.JSX.Element {
	return (
		<Card title={title} description={description} testID={`demo-${title}`}>
			<View className="gap-3">{children}</View>
		</Card>
	);
}
