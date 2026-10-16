import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";

export function Card4Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="border-b">
				<CardTitle>Header with Border</CardTitle>
			</CardHeader>
			<CardContent>
				<p>The footer has a border-t class applied, creating a visual separation between the content and footer sections.</p>
			</CardContent>
			<CardFooter className="border-t">
				<Button variant="outline" className="w-full">
					Action
				</Button>
			</CardFooter>
		</Card>
	);
}
