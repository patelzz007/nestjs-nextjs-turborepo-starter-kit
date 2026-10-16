import * as React from "react";
import { ArrowRightIcon, BellIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import Image from "next/image";

import { CARD_PHOTO_HEIGHT, CARD_PHOTO_WIDTH, CARD_PHOTOS } from "@/components/component-gallery/examples/card/card-sample";

export function Card9Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs p-0">
			<CardContent className="flex flex-col gap-5 p-0">
				<div className="relative h-48 w-full overflow-hidden">
					<Image src={CARD_PHOTOS.fluid} alt="Abstract sample photo" width={CARD_PHOTO_WIDTH} height={CARD_PHOTO_HEIGHT} className="h-full w-full object-cover" />
				</div>

				<div className="flex flex-col items-center gap-4 p-6 pt-0">
					<Badge variant="outline">
						<BellIcon aria-hidden="true" />
						Trending
					</Badge>

					<p className="text-center text-sm text-foreground">Making your design process faster and easier. Design tools for your team.</p>

					<Button className="w-fit">
						Get Started
						<ArrowRightIcon aria-hidden="true" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
