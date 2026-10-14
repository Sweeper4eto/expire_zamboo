/** Default € for a client's first location. */
export const DEFAULT_FIRST_LOCATION_FEE = 20;
/** Default € for 2nd, 3rd, … locations. */
export const DEFAULT_EXTRA_LOCATION_FEE = 15;

export function defaultFeeForLocationIndex(existingLocationCount: number): number {
  return existingLocationCount <= 0
    ? DEFAULT_FIRST_LOCATION_FEE
    : DEFAULT_EXTRA_LOCATION_FEE;
}

/** Sum monthly fees of active locations (or of an already-active-only list). */
export function sumLocationFees(
  stores: Array<{ monthlyFee: number; active?: boolean }>,
): number {
  return stores.reduce((sum, store) => {
    if (store.active === false) return sum;
    return sum + store.monthlyFee;
  }, 0);
}
