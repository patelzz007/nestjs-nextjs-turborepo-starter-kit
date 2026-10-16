import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";

export function Card2Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="border-b">
				<CardTitle>Header with Border</CardTitle>
				<CardDescription>This is a card with a header that has a bottom border.</CardDescription>
			</CardHeader>
			<CardContent>
				<p>The header has a border-b class applied, creating a visual separation between the header and content sections.</p>
			</CardContent>
		</Card>
	);
}
