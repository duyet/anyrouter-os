import { describe, expect, it } from "vitest";
import { uiBundleFromFiles } from "../src/ui-bundle.js";

describe("uiBundleFromFiles", () => {
  it("returns html-only so static HTML can paint without client.js", () => {
    expect(uiBundleFromFiles(undefined, "<h1>Invoice</h1>")).toEqual({
      jsCode: "",
      html: "<h1>Invoice</h1>",
    });
  });

  it("omits html for JavaScript-only gadgets so existing callers stay compatible", () => {
    let bundle = uiBundleFromFiles("document.body.textContent = 'hi'", undefined);
    expect(bundle).toEqual({ jsCode: "document.body.textContent = 'hi'" });
    expect(bundle && "html" in bundle).toBe(false);
  });

  it("returns both files when the gadget ships index.html and client.js", () => {
    expect(uiBundleFromFiles("gadget.ready()", "<p>Deck</p>")).toEqual({
      jsCode: "gadget.ready()",
      html: "<p>Deck</p>",
    });
  });

  it("returns null only when both files are missing", () => {
    expect(uiBundleFromFiles(undefined, undefined)).toBeNull();
  });

  it("treats an empty file as present rather than missing", () => {
    expect(uiBundleFromFiles("", undefined)).toEqual({ jsCode: "" });
    expect(uiBundleFromFiles(undefined, "")).toEqual({ jsCode: "", html: "" });
  });
});
