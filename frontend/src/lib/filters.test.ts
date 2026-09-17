import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  describeFilters,
  parseFilters,
  toSearchParams,
} from "./filters";

describe("parseFilters", () => {
  it("reads every supported key", () => {
    expect(
      parseFilters({
        yearFrom: "2015",
        yearTo: "2020",
        region: "Waikato Region",
        roadType: "Local road - open road",
        speedEnvironment: "81-100 km/h",
        severity: "Fatal Crash",
      }),
    ).toEqual({
      yearFrom: 2015,
      yearTo: 2020,
      region: "Waikato Region",
      roadType: "Local road - open road",
      speedEnvironment: "81-100 km/h",
      severity: "Fatal Crash",
    });
  });

  it("drops malformed years instead of coercing them", () => {
    for (const bad of ["abc", "20.5", "0", "99999", ""]) {
      expect(parseFilters({ yearFrom: bad }).yearFrom).toBeUndefined();
    }
  });

  it("swaps a reversed year range rather than matching nothing", () => {
    const f = parseFilters({ yearFrom: "2022", yearTo: "2010" });
    expect([f.yearFrom, f.yearTo]).toEqual([2010, 2022]);
  });

  it("only accepts known severities", () => {
    expect(parseFilters({ severity: "Catastrophic" }).severity).toBeUndefined();
  });

  it("takes the first value of a repeated key and trims whitespace", () => {
    expect(
      parseFilters({ region: ["  Otago Region ", "Southland Region"] }).region,
    ).toBe("Otago Region");
    expect(parseFilters({ region: "   " }).region).toBeUndefined();
  });
});

describe("toSearchParams", () => {
  it("round-trips through parseFilters", () => {
    const filters = {
      yearFrom: 2018,
      region: "Auckland Region",
      severity: "Serious Crash" as const,
    };
    const params = Object.fromEntries(toSearchParams(filters));
    expect(parseFilters(params)).toMatchObject(filters);
  });

  it("omits unset values", () => {
    expect(toSearchParams({ region: undefined, yearTo: 2020 }).toString()).toBe(
      "yearTo=2020",
    );
  });
});

describe("describeFilters", () => {
  it("collapses the year range into one chip", () => {
    const filters = { yearFrom: 2020, yearTo: 2024, region: "Waikato Region" };
    expect(describeFilters(filters).map((c) => `${c.label}: ${c.value}`)).toEqual([
      "Years: 2020 to 2024",
      "Region: Waikato Region",
    ]);
    expect(activeFilterCount(filters)).toBe(3);
  });

  it("names open-ended ranges", () => {
    expect(describeFilters({ yearFrom: 2020 })[0].value).toBe("2020 to latest");
  });
});
