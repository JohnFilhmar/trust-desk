import { describe, expect, it } from "@jest/globals";
import { cut_page, decode_cursor, encode_cursor } from "#app/lib/pagination/cursor.ts";

const cursor = { at: "2026-09-29 01:02:03.456789", id: 42 };

describe("cursor", () => {
  it("reads back what it packed, microseconds included", () => {
    expect(decode_cursor(encode_cursor(cursor))).toEqual(cursor);
  });

  it("is safe to put in a URL", () => {
    expect(encode_cursor(cursor)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["text that is not base64", "%%%"],
    ["base64 that is not JSON", Buffer.from("hello").toString("base64url")],
    ["a timestamp without microseconds", Buffer.from('{"at":"2026-09-29 01:02:03","id":1}').toString("base64url")],
    ["an id that is not a number", Buffer.from('{"at":"2026-09-29 01:02:03.456789","id":"1"}').toString("base64url")],
    ["an id of zero", Buffer.from('{"at":"2026-09-29 01:02:03.456789","id":0}').toString("base64url")],
    ["SQL in the timestamp", Buffer.from(`{"at":"' OR 1=1 --","id":1}`).toString("base64url")],
  ])("refuses %s", (_name, value) => {
    expect(decode_cursor(value)).toBeNull();
  });
});

describe("cut_page", () => {
  const rows = [5, 4, 3].map((id) => ({ id, at: `2026-09-29 01:02:03.00000${id}` }));
  const position = (row: { id: number; at: string }) => ({ at: row.at, id: row.id });

  it("hides the extra row and points the cursor at the last row shown", () => {
    const { page, next_cursor } = cut_page(rows, 2, position);
    expect(page.map((row) => row.id)).toEqual([5, 4]);
    expect(decode_cursor(next_cursor ?? "")).toEqual({
      at: "2026-09-29 01:02:03.000004",
      id: 4,
    });
  });

  it("returns no cursor when the rows fit the page exactly", () => {
    expect(cut_page(rows, 3, position).next_cursor).toBeNull();
  });

  it("returns an empty page and no cursor for no rows", () => {
    expect(cut_page([], 3, position)).toEqual({ page: [], next_cursor: null });
  });
});
