// What the Avatar examples share: sample people with portraits (the web examples' Unsplash photos).

export interface SamplePortrait {
	readonly name: string;
	readonly photo: string;
}

const PORTRAIT_PARAMS = "?w=96&h=96&dpr=2&q=80";

export const PEOPLE: readonly SamplePortrait[] = [
	{ name: "Sofia Davis", photo: `https://images.unsplash.com/photo-1519699047748-de8e457a634e${PORTRAIT_PARAMS}` },
	{ name: "James Lee", photo: `https://images.unsplash.com/photo-1527980965255-d3b416303d12${PORTRAIT_PARAMS}` },
	{ name: "Marco Rossi", photo: `https://images.unsplash.com/photo-1584308972272-9e4e7685e80f${PORTRAIT_PARAMS}` },
	{ name: "Emma Wilson", photo: `https://images.unsplash.com/photo-1485893086445-ed75865251e0${PORTRAIT_PARAMS}` },
	{ name: "Alex Johnson", photo: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde${PORTRAIT_PARAMS}` },
];

/** The first person, the one most examples show. */
export const [FIRST = { name: "Sofia Davis", photo: "" }] = PEOPLE;
