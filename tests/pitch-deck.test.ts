import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

const root = new URL("../", import.meta.url);

it("keeps the HTML deck on the approved allocation and language", async () => {
  const html = await readFile(new URL("public/pitch-deck/index.html", root), "utf8");
  expect(html).toContain("GUIDE ALLOCATION");
  expect(html).toContain("7.5%");
  expect(html).toContain("47.5%");
  expect(html).toContain("Multiple event needs");
  expect(html).toContain("Allocated automatically");
  expect(html).toContain("Every configured allocation verified");
  expect(html).toContain('data-main-total="4"');
  expect(html.match(/data-backup/g)).toHaveLength(4);
  expect(html).toContain("100000000 stroops");
  expect(html).toContain("750 / 1,500 / 3,000 / 4,750 bps");
  expect(html).not.toContain("Multiple obligations");
  expect(html).not.toContain("Settled automatically");
  expect(html).not.toContain("http://localhost:3001");
});

it("uses one shared demo navigation path with a filesystem fallback", async () => {
  const script = await readFile(new URL("public/pitch-deck/deck.js", root), "utf8");
  expect(script).toContain('window.location.protocol === "file:"');
  expect(script).toContain('new URL("/", window.location.origin).href');
  expect(script.match(/openDemo\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  expect(script).not.toContain("localhost:3001");
});

it("keeps Q&A backups separate from the four-slide pitch", async () => {
  const runtime = await readFile(
    new URL("public/pitch-deck/runtime/runtime.js", root),
    "utf8",
  );

  expect(runtime.indexOf("var CARD_IDS")).toBeLessThan(
    runtime.indexOf("applyLayout(readLayout())"),
  );
  expect(runtime).toContain("update(idx);");
  expect(runtime).toContain("— END OF PITCH —");
  expect(runtime).toContain("— END OF Q&A —");
  expect(runtime).toContain("case 'b': case 'B': toggleBackup()");
  expect(runtime).toContain("#/qna/");
});
