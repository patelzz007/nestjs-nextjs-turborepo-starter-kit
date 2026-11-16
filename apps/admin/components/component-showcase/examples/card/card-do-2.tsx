import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";

export function CardDo2Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader>
				<CardTitle>Pro plan</CardTitle>
				<CardDescription>Unlimited projects and priority support.</CardDescription>
			</CardHeader>
			<CardContent className="text-sm">$24 a month</CardContent>
			<CardFooter>
				<Button className="w-full">Upgrade</Button>
			</CardFooter>
		</Card>
	);
}
