// `React.memo` for a component with a type parameter that cannot be widened.
//
// The kit re-types a memoised generic component with a generic call signature
// (`export const Select: SelectComponent = React.memo(…)`), which works while
// the props of `Select<string>` fit the props of the widened `Select`. A
// TanStack table does not: `Table<Row>` is invariant in its row type, so no
// widened table type accepts every caller's table. This keeps the component's
// own generic signature through the memo instead (TypeScript carries a type
// parameter through a function that takes and returns a plain function type).
// Such a component takes its ref as a prop (React 19), since `forwardRef` would
// erase the type parameter just the same.

import * as React from "react";

/** `React.memo(component)`, typed as the component itself so its type parameters survive. */
export function memo<TProps extends object>(component: (props: TProps) => React.ReactNode): (props: TProps) => React.ReactNode {
	return React.memo(component);
}
