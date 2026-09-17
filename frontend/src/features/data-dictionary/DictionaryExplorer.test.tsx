/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DataDictionaryField } from "@/types";
import { DictionaryExplorer } from "./DictionaryExplorer";

const field = (
  name: string,
  overrides: Partial<DataDictionaryField> = {},
): DataDictionaryField => ({
  name,
  group: "Road & environment conditions",
  description: `${name} description`,
  type: "Text",
  example: "x",
  missingPct: 0,
  distinct: 2,
  derived: false,
  usedInDashboard: false,
  ml: "No",
  ...overrides,
});

const fields = [
  field("weatherA", { description: "Primary weather condition", ml: "Candidate" }),
  field("speedLimit", { description: "Posted speed limit" }),
  field("fatalCount", { group: "Crash severity & casualty counts", ml: "Excluded" }),
  field("holiday", { group: "Time", missingPct: 94.5, usedInDashboard: true }),
];

afterEach(cleanup);

const count = () => screen.getByText(/^Showing/).textContent;

describe("DictionaryExplorer", () => {
  it("shows every column by default", () => {
    render(<DictionaryExplorer fields={fields} />);
    expect(count()).toBe("Showing 4 of 4 columns");
  });

  it("searches names and descriptions", () => {
    render(<DictionaryExplorer fields={fields} />);
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "weather" },
    });
    expect(count()).toBe("Showing 1 of 4 columns");
  });

  it("filters by model role and by missingness", () => {
    render(<DictionaryExplorer fields={fields} />);
    const show = screen.getByLabelText("Show");

    fireEvent.change(show, { target: { value: "excluded" } });
    expect(count()).toBe("Showing 1 of 4 columns");

    fireEvent.change(show, { target: { value: "sparse" } });
    expect(count()).toBe("Showing 1 of 4 columns");
  });

  it("explains an empty result and clears back to everything", () => {
    render(<DictionaryExplorer fields={fields} />);
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "no such column" },
    });
    expect(screen.getByText("No columns match")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(count()).toBe("Showing 4 of 4 columns");
  });
});
