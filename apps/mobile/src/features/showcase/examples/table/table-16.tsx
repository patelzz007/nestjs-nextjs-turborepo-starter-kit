import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";
import { Text, View } from "react-native";

import { DetailRow, PersonCell } from "./table-sample";

// A vertical table: one employee's details, each a label and its value.
export function Table16Example(): React.JSX.Element {
	return (
		<View accessibilityLabel="Employee profile" className="overflow-hidden rounded-lg border border-border bg-background">
			<DetailRow label="Employee">
				<PersonCell name="Sarah Chen" line="Lead Product Designer" />
			</DetailRow>
			<DetailRow label="Department">
				<Text className="text-label font-sans text-foreground">Design & User Experience</Text>
			</DetailRow>
			<DetailRow label="Email">
				<Text className="text-label font-sans text-primary">sarah.chen@acmecorp.com</Text>
			</DetailRow>
			<DetailRow label="Location">
				<Text className="text-label font-sans text-foreground">San Francisco, CA</Text>
			</DetailRow>
			<DetailRow label="Status">
				<Badge label="Active" tone="success" variant="light" size="sm" />
			</DetailRow>
			<DetailRow label="Start Date">
				<Text className="text-label font-sans text-foreground">March 15, 2022</Text>
			</DetailRow>
			<DetailRow label="Reports To" last>
				<Text className="text-label font-sans text-foreground">James Rodriguez, VP of Design</Text>
			</DetailRow>
		</View>
	);
}
