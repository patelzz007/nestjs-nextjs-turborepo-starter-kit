/**
 * The app drawer (ADR 038): whether the menu panel is open. Owner: this Zustand
 * feature store, one per (app) group mount — signing out unmounts the group and
 * the drawer starts closed next time. Not persisted.
 */
export interface AppDrawerState {
	readonly isOpen: boolean;
}

export const INITIAL_APP_DRAWER_STATE: AppDrawerState = { isOpen: false };
