import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";

export function CardDont2Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader>
				<CardTitle>Pro plan</CardTitle>
				<CardDescription>Unlimited projects and priority support.</CardDescription>
			</CardHeader>
			<CardContent className="text-sm">$24 a month</CardContent>
			<CardFooter className="flex-wrap gap-2">
				<Button>Upgrade</Button>
				<Button>Compare</Button>
				<Button>Contact</Button>
				<Button>Share</Button>
			</CardFooter>
		</Card>
	);
}
