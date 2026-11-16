import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";

export function CardDont1Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader>
				<CardTitle>Billing address</CardTitle>
				<CardDescription>Shown on every invoice.</CardDescription>
			</CardHeader>
			<CardContent>
				<Card>
					<CardContent className="text-sm">100 Market St, San Francisco</CardContent>
				</Card>
			</CardContent>
		</Card>
	);
}
