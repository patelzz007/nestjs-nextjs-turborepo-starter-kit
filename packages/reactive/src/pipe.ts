import type { Observable } from "./observable";

/** An operator is a pure function from one observable to another. */
export type Operator<Input, Output> = (source: Observable<Input>) => Observable<Output>;

/**
 * `pipe` — variadic operator composition (design item 10).
 *
 * Arity-typed overloads up to 6 operators (the repo guidance: keep pipelines
 * ≤ 5–6 operators and extract named observables beyond that — pitfall 7).
 * The implementation is cast-free: optional trailing params + a union return.
 */
export function pipe<A, B>(op1: Operator<A, B>): Operator<A, B>;
export function pipe<A, B, C>(op1: Operator<A, B>, op2: Operator<B, C>): Operator<A, C>;
export function pipe<A, B, C, D>(op1: Operator<A, B>, op2: Operator<B, C>, op3: Operator<C, D>): Operator<A, D>;
export function pipe<A, B, C, D, E>(op1: Operator<A, B>, op2: Operator<B, C>, op3: Operator<C, D>, op4: Operator<D, E>): Operator<A, E>;
export function pipe<A, B, C, D, E, F>(op1: Operator<A, B>, op2: Operator<B, C>, op3: Operator<C, D>, op4: Operator<D, E>, op5: Operator<E, F>): Operator<A, F>;
export function pipe<A, B, C, D, E, F, G>(
	op1: Operator<A, B>,
	op2: Operator<B, C>,
	op3: Operator<C, D>,
	op4: Operator<D, E>,
	op5: Operator<E, F>,
	op6: Operator<F, G>,
): Operator<A, G>;
export function pipe<A, B, C, D, E, F>(
	op1: Operator<A, B>,
	op2?: Operator<B, C>,
	op3?: Operator<C, D>,
	op4?: Operator<D, E>,
	op5?: Operator<E, F>,
): Operator<A, B | C | D | E | F> {
	return (source: Observable<A>): Observable<B | C | D | E | F> => {
		if (op2 === undefined) {
			return op1(source);
		}
		if (op3 === undefined) {
			return op2(op1(source));
		}
		if (op4 === undefined) {
			return op3(op2(op1(source)));
		}
		if (op5 === undefined) {
			return op4(op3(op2(op1(source))));
		}
		return op5(op4(op3(op2(op1(source)))));
	};
}
