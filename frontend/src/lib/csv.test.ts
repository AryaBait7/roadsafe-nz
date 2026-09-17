import { describe, expect, it } from "vitest";
import { buildCsv, toCsvCell } from "./csv";

describe("toCsvCell", () => {
  it("neutralises formula-leading text (CSV injection)", () => {
    expect(toCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(toCsvCell("+1")).toBe("'+1");
    expect(toCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(toCsvCell("-2+3")).toBe("'-2+3");
  });

  it("leaves negative numbers as numbers", () => {
    expect(toCsvCell(-0.79)).toBe("-0.79");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsvCell("Hawke's Bay, NZ")).toBe(`"Hawke's Bay, NZ"`);
    expect(toCsvCell('say "hi"')).toBe(`"say ""hi"""`);
    expect(toCsvCell("a\nb")).toBe(`"a\nb"`);
    expect(toCsvCell("a\rb")).toBe(`"a\rb"`);
  });

  it("keeps macrons intact", () => {
    expect(toCsvCell("Manawatū-Whanganui Region")).toBe(
      "Manawatū-Whanganui Region",
    );
  });
});

describe("buildCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    expect(
      buildCsv(
        ["region", "crashes"],
        [
          ["Otago Region", 1],
          ["Nelson Region", 2],
        ],
      ),
    ).toBe("region,crashes\r\nOtago Region,1\r\nNelson Region,2");
  });
});
