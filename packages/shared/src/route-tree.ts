/** Nested route tree — leaves are path strings, branches are named groups. */
export type RouteTree = string | { readonly [key: string]: RouteTree };
