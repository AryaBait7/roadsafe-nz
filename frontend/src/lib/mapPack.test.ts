import { describe, expect, it } from "vitest";
import { getMapPoints } from "@/services/crashService";
import { packPoints, unpackPoints } from "./mapPack";

describe("map point packing", () => {
  it("round-trips the real grid exactly", async () => {
    const { data } = await getMapPoints();
    expect(unpackPoints(packPoints(data))).toEqual(data);
  });

  it("is much smaller than the object form", async () => {
    const { data } = await getMapPoints();
    const objects = JSON.stringify(data).length;
    const packed = JSON.stringify(packPoints(data)).length;
    expect(packed).toBeLessThan(objects / 2.5);
  });
});
