import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultFeeForLocationIndex,
  sumLocationFees,
} from "../src/lib/location-fees";
import { paymentAmount } from "../src/lib/expiry";

describe("location fees", () => {
  it("defaults first location to 20 and extras to 15", () => {
    assert.equal(defaultFeeForLocationIndex(0), 20);
    assert.equal(defaultFeeForLocationIndex(1), 15);
    assert.equal(defaultFeeForLocationIndex(5), 15);
  });

  it("sums only active location fees", () => {
    assert.equal(
      sumLocationFees([
        { monthlyFee: 20, active: true },
        { monthlyFee: 15, active: true },
        { monthlyFee: 15, active: false },
      ]),
      35,
    );
  });

  it("builds expected payment from fee sum", () => {
    assert.equal(paymentAmount(sumLocationFees([{ monthlyFee: 20 }, { monthlyFee: 15 }]), 5), 30);
  });
});
