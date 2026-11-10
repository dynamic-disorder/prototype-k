# Insert cards

**Executive summary:** Use a static HTML card when the point is not on an app screen. Write one 16:9 page, load it as one beat, keep it offline.

For numbers, a plan, or a document that is not part of the app, record a static HTML page as one more beat. It keeps the recording honest — the figures are on screen in a readable type size instead of being scrolled past in a table.

## When

- A results card ("6 cases, 68 findings, 36/36 quotes located").
- A plan card ("one team, six weeks").
- A rendered document page (evidence pack, exported report).
- Any beat where the app has no screen for the point being made.

## How

1. Write `number-card.html` in the task folder. One column, 16:9, no external assets:

```html
<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root { --paper:#f5f3ee; --ink:#191a1b; --muted:#6d6b64; --accent:#12544a; --line:#ddd7ca; }
  * { box-sizing:border-box }
  html,body { margin:0; height:100%; background:var(--paper); color:var(--ink);
    font-family: ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif }
  .wrap { max-width:1280px; margin:0 auto; padding:86px 72px }
  .eyebrow { font:600 14px/1.4 ui-monospace, Consolas, monospace; letter-spacing:.14em;
    text-transform:uppercase; color:var(--accent); margin-bottom:26px }
  h1 { font-size:58px; line-height:1.08; letter-spacing:-.03em; font-weight:600; margin:0 0 54px; max-width:18ch }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18px;
    border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:30px 0 }
  .cell b { display:block; font:600 58px/1 ui-monospace, Consolas, monospace; letter-spacing:-.04em }
  .cell span { display:block; margin-top:10px; font-size:15px; color:var(--muted) }
  .note { margin-top:34px; font-size:17px; color:var(--muted); max-width:74ch }
</style></head><body>
  <div class="wrap">
    <div class="eyebrow">Measured · 2026-11-07 · run printed by the command</div>
    <h1>Six cases. Sixty-eight findings. Every expectation holds.</h1>
    <div class="grid">
      <div class="cell"><b>6</b><span>seeded cases</span></div>
      <div class="cell"><b>68</b><span>findings</span></div>
      <div class="cell"><b>68/68</b><span>expected statuses</span></div>
      <div class="cell"><b>36/36</b><span>quotes located</span></div>
    </div>
    <p class="note">Numbers come from the run named in the caption; no number is retyped from memory.</p>
  </div>
</body></html>
```

2. In `record.mjs`, add a beat that loads it as a file URL:

```js
import { pathToFileURL } from "node:url";
const cardUrl = pathToFileURL(path.join(OUT, "number-card.html")).href;

await at(97.5, "numbers card", async () => {
  await page.goto(cardUrl, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
});
```

3. The next beat moves on; nothing else changes.

## Pitfalls

- Load with `waitUntil: "load"` **and** `document.fonts.ready`; a card captured mid-font-swap has wrong metrics.
- No CDN fonts, no remote images: the page must render identically offline.
- Never put a machine path, account name, or internal hostname in the card. A date and the command that produced the figures are enough provenance.
- Photos of a document: render the Markdown/HTML export, do not screenshot a PDF viewer chrome.
- Keep card type at least 28 px for body text at 1600×900; the video is often watched at 50% size.
