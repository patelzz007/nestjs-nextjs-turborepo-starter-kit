/** Rejects after `ms` — used as the losing branch of `Promise.race` timeouts. */
export function rejectAfter<T>(ms: number, error: Error): Promise<T> {
	return new Promise<T>((_resolve, reject): void => {
		setTimeout((): void => {
			reject(error);
		}, ms);
	});
}
