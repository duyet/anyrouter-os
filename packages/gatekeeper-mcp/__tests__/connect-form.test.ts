import { describe, expect, it } from "vitest";

import { connectFormHtml } from "../src/connect-form.js";

// The prefill is what makes a deployment's own MCP server connectable without a pasted URL. It has
// to stay a default rather than a restriction, so these cases pin both the value and the fact that
// the field is still an ordinary editable input.
describe("connectFormHtml", () => {
  it("prefills the deployment's suggested endpoint", () => {
    let html = connectFormHtml("/connect", undefined, "https://anyrouter.dev/api/v1/mcp");
    expect(html).toContain('value="https://anyrouter.dev/api/v1/mcp"');
    expect(html).toContain('name="url"');
  });

  it("leaves the field empty when the deployment suggests nothing", () => {
    expect(connectFormHtml("/connect")).not.toContain("value=");
  });

  it("escapes a suggestion rather than letting it close the attribute", () => {
    let html = connectFormHtml("/connect", undefined, 'https://x/"><script>alert(1)</script>');
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
