export type AppDrawerAction = { readonly type: "[ App Drawer ] Opened" } | { readonly type: "[ App Drawer ] Closed" };

export const appDrawerActions = {
	opened: (): AppDrawerAction => ({ type: "[ App Drawer ] Opened" }),
	closed: (): AppDrawerAction => ({ type: "[ App Drawer ] Closed" }),
};
