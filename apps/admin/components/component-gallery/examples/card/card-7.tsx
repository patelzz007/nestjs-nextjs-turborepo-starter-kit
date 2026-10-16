import * as React from "react";
import { ArrowRightIcon, BellIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import Image from "next/image";

import { CARD_PHOTO_HEIGHT, CARD_PHOTO_WIDTH, CARD_PHOTOS } from "@/components/component-gallery/examples/card/card-sample";

export function Card7Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardContent className="flex flex-col gap-4">
				<div className="relative h-48 w-full overflow-hidden rounded-lg">
					<Image src={CARD_PHOTOS.gradient} alt="Abstract sample photo" width={CARD_PHOTO_WIDTH} height={CARD_PHOTO_HEIGHT} className="h-full w-full object-cover" />
				</div>

				<div className="flex items-center justify-between gap-5">
					<Badge variant="outline">
						<BellIcon aria-hidden="true" />
						Trending
					</Badge>
					<div className="flex items-center gap-1">
						<SparklesIcon aria-hidden="true" />
						<span className="text-xs font-medium text-secondary-foreground">Featured</span>
					</div>
				</div>

				<p className="text-sm text-foreground">Simplifying your workflow from day one. Manage your tasks, projects, and team in one place.</p>

				<Button>
					Get Started
					<ArrowRightIcon aria-hidden="true" />
				</Button>
			</CardContent>
		</Card>
	);
}
