import { describe, expect, it } from "vitest";

import { shouldIncludeSalesGrade } from "../DeliveryVsConsumptionChart";

describe("shouldIncludeSalesGrade", () => {
  it("uses regular tank sales when E15 is selected", () => {
    expect(shouldIncludeSalesGrade("Regular", ["E15"])).toBe(true);
  });

  it("does not double represent E15 as a separate sales grade", () => {
    expect(shouldIncludeSalesGrade("E15", ["E15"])).toBe(true);
  });

  it("keeps all other grade matching exact", () => {
    expect(shouldIncludeSalesGrade("Premium", ["E15"])).toBe(false);
    expect(shouldIncludeSalesGrade("Diesel", ["Diesel"])).toBe(true);
  });
});
