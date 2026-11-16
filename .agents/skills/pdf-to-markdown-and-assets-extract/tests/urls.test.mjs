/**
 * Dropping a printed address: `--drop-relative-urls` removes the `URL:` block a
 * scraped wiki page prints, records how many it removed, and leaves an address
 * that appears inside a sentence alone.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stripRelativeUrls } from "../lib/pdf-extract.mjs";

describe("dropping relative web addresses", () => {
  it("removes a URL line and its bare label", () => {
    const markdown = ["Something Ends", "", "URL:", "https://example.org/wiki/Story", "", "The story."].join("\n");
    const result = stripRelativeUrls(markdown);
    assert.equal(result.dropped, 1);
    assert.equal(result.markdown, ["Something Ends", "", "The story."].join("\n"));
  });

  it("removes a file: link a wiki page carries", () => {
    const result = stripRelativeUrls(["before", "file:///C:/wiki/Geralt", "after"].join("\n"));
    assert.equal(result.dropped, 1);
    assert.equal(result.markdown, ["before", "after"].join("\n"));
  });

  it("keeps an address inside a sentence", () => {
    const markdown = "Source https://example.org/a is cited here.";
    const result = stripRelativeUrls(markdown);
    assert.equal(result.dropped, 0);
    assert.equal(result.markdown, markdown);
  });

  it("keeps the page markers and the body that follows", () => {
    const markdown = ["<!-- page: 1 -->", "", "URL:", "www.example.org/x", "", "Body text."].join("\n");
    const result = stripRelativeUrls(markdown);
    assert.match(result.markdown, /<!-- page: 1 -->/);
    assert.match(result.markdown, /Body text\./);
    assert.doesNotMatch(result.markdown, /www\.example\.org/);
  });
  it("keeps a publisher address printed on its own line", () => {
    const markdown = ["Front matter.", "http://www.example-publisher.co.uk", "Body."].join("\n");
    const result = stripRelativeUrls(markdown);
    assert.equal(result.dropped, 0);
    assert.equal(result.markdown, markdown);
  });
});