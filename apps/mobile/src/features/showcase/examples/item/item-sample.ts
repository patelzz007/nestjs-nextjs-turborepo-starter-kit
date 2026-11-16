// Sample people for the Item examples: the web examples' portraits (images.unsplash.com).

export interface SamplePerson {
	readonly name: string;
	readonly imageUrl: string;
}

export const SARAH: SamplePerson = { name: "Sarah Chen", imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80" };
export const ALEX: SamplePerson = { name: "Alex Johnson", imageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" };
export const DAVID: SamplePerson = { name: "David Kim", imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80" };
export const EMILY: SamplePerson = { name: "Emily Park", imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80" };
