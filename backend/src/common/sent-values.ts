// The fields of a request body that were sent, without the ones left out (a DTO instance holds them as undefined),
// and its amounts as saved however they were typed ("1.5" is saved as 1.50), so an unchanged amount isn't a change.
export function sentValues<T extends object>(body: T, amountFields: readonly string[]): Partial<T> {
  return Object.fromEntries(Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([field, value]) => [field, amountFields.includes(field) ? Number(value).toFixed(2) : value])) as Partial<T>;
}
