import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "vite";

const executablePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
]
  .filter(Boolean)
  .find(existsSync);
if (!executablePath)
  throw new Error("Set CHROME_PATH to a Chrome or Edge executable.");
const server = await createServer({
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5175", { waitUntil: "networkidle" });
  const count = () => page.locator(".react-flow__node-studio").count();
  const exportDocument = async () => {
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export JSON", exact: true })
      .click();
    return JSON.parse(readFileSync(await (await download).path(), "utf8"));
  };
  const insert = async (name) => {
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    assert.equal(await page.locator(".template-card").count(), 7);
    await page
      .locator(".template-card")
      .filter({ has: page.getByText(name, { exact: true }) })
      .click();
    await page.locator("dialog").waitFor({ state: "detached" });
    await page.waitForTimeout(350);
  };
  const selectEdge = async (id) => {
    const p = await page
      .locator(`.react-flow__edge[data-id="${id}"] .chen-edge-hit`)
      .evaluate((path) => {
        const point = path
          .getPointAtLength(path.getTotalLength() * 0.7)
          .matrixTransform(path.getScreenCTM());
        return { x: point.x, y: point.y };
      });
    await page.mouse.click(p.x, p.y);
  };
  console.log("Checking templates and document undo…");
  await insert("Weak entity");
  assert.equal(await count(), 14);
  await page.keyboard.press("Control+z");
  assert.equal(await count(), 10);
  await page.getByRole("button", { name: "New diagram", exact: true }).click();
  await page.keyboard.press("Control+z");
  assert.equal(await count(), 10);
  await page.keyboard.press("Control+Shift+z");
  assert.equal(await count(), 0);
  await insert("Min–max participation");
  console.log("Checking participation presets…");
  let doc = await exportDocument();
  const customerEdge = doc.edges.find(
    (e) => e.data.cardinalityMode === "minmax" && e.data.minimum === "0",
  );
  await selectEdge(customerEdge.id);
  const inspector = page.getByRole("complementary", {
    name: "Properties inspector",
  });
  await inspector.getByRole("button", { name: "(1,N)", exact: true }).click();
  assert.equal(
    await page
      .locator(
        `.react-flow__edge[data-id="${customerEdge.id}"] .chen-edge-geometry > path`,
      )
      .count(),
    2,
  );
  assert.equal(
    await page.getByLabel("Minimum", { exact: true }).inputValue(),
    "1",
  );
  await page.getByLabel("Minimum", { exact: true }).fill("6");
  await page.getByLabel("Maximum", { exact: true }).fill("2");
  await inspector
    .getByText("Minimum participation exceeds maximum participation.", {
      exact: true,
    })
    .waitFor();
  await inspector.getByRole("button", { name: "(0,N)", exact: true }).click();
  assert.equal(
    await page
      .locator(
        `.react-flow__edge[data-id="${customerEdge.id}"] .chen-edge-geometry > path`,
      )
      .count(),
    1,
  );
  assert.equal(await page.locator(".warning").count(), 0);
  await page.getByRole("tab", { name: "Model", exact: true }).click();
  console.log("Checking outline and connected attributes…");
  await page.getByLabel("Find element", { exact: true }).fill("customer");
  assert.equal(await page.locator(".outline-item").count(), 2);
  await page
    .locator(".outline-item")
    .filter({ has: page.getByText("CUSTOMER", { exact: true }) })
    .click();
  await inspector
    .getByRole("button", { name: "Key attribute", exact: true })
    .click();
  await page.locator(".inline-rename").fill("Email");
  await page.locator(".inline-rename").press("Enter");
  assert.equal(await count(), 6);
  doc = await exportDocument();
  const key = doc.nodes.find((n) => n.data.name === "Email");
  assert.equal(key.data.attribute.isKey, true);
  assert.ok(
    doc.edges.some(
      (e) => e.source === key.id && e.target === customerEdge.source,
    ),
  );
  await page.getByRole("button", { name: "New diagram", exact: true }).click();
  await insert("Overlapping subclasses");
  console.log("Checking all EER constraints…");
  doc = await exportDocument();
  const group = doc.nodes.find((n) => n.data.kind === "specialization");
  const parentEdge = doc.edges.find(
    (e) => e.data.kind === "specialization-parent",
  );
  await page.keyboard.press("Escape");
  await page.locator(`.react-flow__node[data-id="${group.id}"]`).click();
  for (const [label, constraint, completeness] of [
    ["d · partial", "disjoint", "partial"],
    ["d · total", "disjoint", "total"],
    ["o · partial", "overlap", "partial"],
    ["o · total", "overlap", "total"],
  ]) {
    await inspector.getByRole("button", { name: label, exact: true }).click();
    assert.equal(
      await page.getByLabel("Constraint", { exact: true }).inputValue(),
      constraint,
    );
    assert.equal(
      await page.getByLabel("Completeness", { exact: true }).inputValue(),
      completeness,
    );
    assert.equal(
      await page
        .locator(
          `.react-flow__edge[data-id="${parentEdge.id}"] .chen-edge-geometry > path`,
        )
        .count(),
      completeness === "total" ? 2 : 1,
    );
    assert.equal(
      await page
        .locator(`.react-flow__node[data-id="${group.id}"] svg text`)
        .textContent(),
      constraint === "disjoint" ? "d" : "o",
    );
  }
  doc = await exportDocument();
  console.log("Checking movement, layout and navigation…");
  await page.getByRole("button", { name: "Select tool", exact: true }).click();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.up("ArrowRight");
  const moved = await exportDocument();
  assert.equal(
    moved.nodes.find((n) => n.id === group.id).position.x,
    doc.nodes.find((n) => n.id === group.id).position.x + 1,
  );
  await page.keyboard.press("Control+z");
  assert.equal(
    (await exportDocument()).nodes.find((n) => n.id === group.id).position.x,
    doc.nodes.find((n) => n.id === group.id).position.x,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Tidy layout", exact: true }).click();
  const arranged = await exportDocument();
  assert.deepEqual(
    arranged.edges.map((e) => e.data),
    doc.edges.map((e) => e.data),
  );
  assert.ok(
    arranged.nodes.some(
      (n, i) =>
        n.position.x !== doc.nodes[i].position.x ||
        n.position.y !== doc.nodes[i].position.y,
    ),
  );
  await page.keyboard.press("Control+z");
  assert.deepEqual(
    (await exportDocument()).nodes.map((n) => n.position),
    doc.nodes.map((n) => n.position),
  );
  await page
    .getByRole("button", { name: "Toggle minimap", exact: true })
    .click();
  assert.ok(await page.locator(".react-flow__minimap").isVisible());
  await page
    .getByRole("button", { name: "Notation guide", exact: true })
    .click();
  assert.ok(await page.getByRole("dialog").isVisible());
  await page.keyboard.press("e");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Select tool", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByLabel("Diagram name").fill("Người và vai trò");
  await page.getByLabel("Diagram name").press("Enter");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("Diagram name").inputValue(),
    "Người và vai trò",
  );
  await page
    .locator(".react-flow__node-studio")
    .filter({ has: page.locator('svg[aria-label="specialization: d"]') })
    .click();
  if (process.env.CHEN_FEATURE_SCREENSHOT)
    await page.screenshot({ path: process.env.CHEN_FEATURE_SCREENSHOT });
  await page.setViewportSize({ width: 820, height: 620 });
  await page
    .getByRole("button", { name: "Expand elements", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Expand properties", exact: true })
    .waitFor();
  assert.ok((await page.locator(".canvas-wrap").boundingBox()).width >= 800);
  await page
    .getByRole("button", { name: "Notation guide", exact: true })
    .click();
  const modalBox = await page.getByRole("dialog").boundingBox();
  assert.ok(modalBox.width <= 820 && modalBox.height <= 620);
  assert.deepEqual(errors, []);
  console.log(
    "Feature checks passed: template undo, New undo, min–max and double lines, connected key, all four EER constraints, nudge undo, layout undo, outline, minimap, modal shortcuts, immediate save/reload, narrow screen.",
  );
} finally {
  await browser?.close();
  await server.close();
}
