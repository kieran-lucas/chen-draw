import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "vite";

const candidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const executablePath = candidates.find((path) => existsSync(path));
if (!executablePath)
  throw new Error(
    "Chrome or Edge is required for the browser smoke test. Set CHROME_PATH to its executable.",
  );
const server = await createServer({
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 960 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
  const starterNodes = await page.locator(".react-flow__node-studio").count();
  const starterEdges = await page.locator(".react-flow__edge").count();
  const totalEdge = page.locator('.react-flow__edge[data-id="e1"]');
  const edgeRail = totalEdge.locator('.chen-edge-geometry > path');
  const railPaths = await edgeRail.evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
  const firstPoints = railPaths.map((d) => d.match(/^M ([\d.-]+) ([\d.-]+)/).slice(1).map(Number));
  const railGap = Math.hypot(firstPoints[0][0] - firstPoints[1][0], firstPoints[0][1] - firstPoints[1][1]);
  const unselectedEdgeClear = await totalEdge.locator('.chen-edge-hit').evaluate((path) =>
    getComputedStyle(path).strokeOpacity === '0'
  );
  if (process.env.CHEN_EDGE_SCREENSHOT) await totalEdge.screenshot({ path: process.env.CHEN_EDGE_SCREENSHOT });
  const pointOnEdge = await totalEdge.locator('.chen-edge-hit').evaluate((path) => {
    const point = path.getPointAtLength(path.getTotalLength() * 0.25).matrixTransform(path.getScreenCTM());
    return { x: point.x, y: point.y };
  });
  await page.mouse.click(pointOnEdge.x, pointOnEdge.y);
  await totalEdge.locator('.chen-edge-hit').waitFor();
  const selectedEdgeClear = await totalEdge.evaluate((element) => {
    const hit = element.querySelector('.chen-edge-hit');
    const rail = element.querySelector('.chen-edge-geometry > path');
    return element.classList.contains('selected') && getComputedStyle(hit).strokeOpacity === '0' && getComputedStyle(rail).filter === 'none';
  });
  const doubleLineClear = railPaths.length === 2 && railGap >= 7.5 && unselectedEdgeClear && selectedEdgeClear;
  await page.getByRole("button", { name: "New diagram" }).click();
  const pane = await page.locator(".react-flow__pane").boundingBox();
  const beforePan = await page.locator(".react-flow__viewport").getAttribute("style");
  await page.mouse.move(pane.x + 100, pane.y + 100);
  await page.mouse.down();
  await page.mouse.move(pane.x + 220, pane.y + 170, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(
    (previous) => document.querySelector(".react-flow__viewport")?.getAttribute("style") !== previous,
    beforePan,
  );
  const panWorks = (await page.locator(".react-flow__viewport").getAttribute("style")) !== beforePan;
  await page.getByLabel("Diagram name").fill("SHOULD_CANCEL");
  await page.getByLabel("Diagram name").press("Escape");
  await page
    .locator(".palette-item")
    .filter({ hasText: "Single rectangle" })
    .click();
  await page
    .locator(".react-flow__pane")
    .click({ position: { x: 220, y: 230 } });
  await page.locator(".inline-rename").fill("PERSON");
  await page.locator(".inline-rename").press("Enter");
  await page
    .locator(".palette-item")
    .filter({ hasText: "Diamond" })
    .first()
    .click();
  await page
    .locator(".react-flow__pane")
    .click({ position: { x: 490, y: 230 } });
  await page.locator(".inline-rename").fill("MEMBER_OF");
  await page.locator(".inline-rename").press("Enter");
  const person = page
    .locator(".react-flow__node-studio")
    .filter({ has: page.locator('svg[aria-label="entity: PERSON"]') });
  await person.dblclick();
  await page.locator(".inline-rename").fill("SHOULD_CANCEL");
  await page.locator(".inline-rename").press("Escape");
  await person.waitFor();
  const relationship = page
    .locator(".react-flow__node-studio")
    .filter({ has: page.locator('svg[aria-label="relationship: MEMBER_OF"]') });
  const personBox = await person.boundingBox();
  const relationshipBox = await relationship.boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(personBox.x - 18, personBox.y - 18);
  await page.mouse.down();
  await page.mouse.move(
    relationshipBox.x + relationshipBox.width + 18,
    relationshipBox.y + relationshipBox.height + 18,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const shiftSelectWorks = (await page.locator(".react-flow__node-studio.selected").count()) === 2;
  await page.locator(".react-flow__pane").click({ position: { x: 30, y: 30 } });
  await person.hover();
  const sourceBox = await person.locator(".chen-handle").nth(1).boundingBox();
  const targetBox = await relationship
    .locator(".chen-handle")
    .nth(6)
    .boundingBox();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();
  const createdEdges = await page.locator(".react-flow__edge").count();
  await person.hover();
  const againSource = await person.locator(".chen-handle").nth(1).boundingBox();
  const againTarget = await relationship
    .locator(".chen-handle")
    .nth(6)
    .boundingBox();
  await page.mouse.move(
    againSource.x + againSource.width / 2,
    againSource.y + againSource.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    againTarget.x + againTarget.width / 2,
    againTarget.y + againTarget.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();
  const repeatedEdges = await page.locator(".react-flow__edge").count();
  await page
    .locator(".palette-item")
    .filter({ hasText: "Single rectangle" })
    .click();
  await page
    .locator(".react-flow__pane")
    .click({ position: { x: 750, y: 230 } });
  await page.locator(".inline-rename").fill("STUDENT");
  await page.locator(".inline-rename").press("Enter");
  const student = page
    .locator(".react-flow__node-studio")
    .filter({ has: page.locator('svg[aria-label="entity: STUDENT"]') });
  await page
    .locator(".palette-item")
    .filter({ hasText: "Direct subclass / IS-A" })
    .click();
  await person.click();
  await student.click();
  await person.click();
  await page.getByLabel("Name", { exact: true }).fill("PERSON_EDITED");
  await student.click();
  await page.keyboard.press("Control+z");
  await person.waitFor();
  const undoGrouped =
    (await page.locator('svg[aria-label="entity: PERSON_EDITED"]').count()) ===
    0;
  const jsonPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const jsonDownload = await jsonPromise;
  const document = JSON.parse(readFileSync(await jsonDownload.path(), "utf8"));
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const download = await downloadPromise;
  const svg = readFileSync(await download.path(), "utf8");
  const pngPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const png = await pngPromise;
  const pngBytes = readFileSync(await png.path());
  await page.getByText("Saved locally").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  const restoredEdges = await page.locator(".react-flow__edge").count();
  await page
    .locator(".react-flow__pane")
    .click({ button: "right", position: { x: 60, y: 70 } });
  const canvasContextMenu = await page
    .getByRole("menuitem", { name: "Add entity" })
    .isVisible();
  await page
    .locator(".palette-item")
    .filter({ hasText: "Double rectangle" })
    .click();
  await page
    .locator(".react-flow__pane")
    .click({ position: { x: 320, y: 540 } });
  await page.locator(".inline-rename").fill("WEAK_ITEM");
  await page.locator(".inline-rename").press("Enter");
  const weakJsonPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const weakJson = JSON.parse(
    readFileSync(await (await weakJsonPromise).path(), "utf8"),
  );
  const weakPaletteWorks = weakJson.nodes.some(
    (n) => n.data.name === "WEAK_ITEM" && n.data.weak,
  );
  const weakNode = page
    .locator(".react-flow__node-studio")
    .filter({ has: page.locator('svg[aria-label="entity: WEAK_ITEM"]') });
  const beforeDrag = await weakNode.boundingBox();
  await page.mouse.move(
    beforeDrag.x + beforeDrag.width / 2,
    beforeDrag.y + beforeDrag.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    beforeDrag.x + beforeDrag.width / 2 + 60,
    beforeDrag.y + beforeDrag.height / 2 + 35,
    { steps: 10 },
  );
  await page.mouse.up();
  const afterDrag = await weakNode.boundingBox();
  await page.keyboard.press("Control+z");
  const afterDragUndo = await weakNode.boundingBox();
  const dragUndoGrouped =
    Math.abs(afterDrag.x - beforeDrag.x) > 20 &&
    Math.abs(afterDragUndo.x - beforeDrag.x) < 2;
  const entityTemplate = document.nodes.find((n) => n.data.kind === "entity");
  const isaTemplate = document.edges.find((e) => e.data.kind === "isa");
  const largeDocument = {
    version: 1,
    title: "Large conceptual EER",
    nodes: Array.from({ length: 220 }, (_, i) => ({
      id: `large-${i}`,
      type: "studio",
      position: { x: (i % 20) * 180, y: Math.floor(i / 20) * 125 },
      data: { ...entityTemplate.data, name: `ENTITY_${i}` },
    })),
    edges: Array.from({ length: 219 }, (_, i) => ({
      id: `large-edge-${i}`,
      type: "chen",
      source: `large-${i}`,
      target: `large-${i + 1}`,
      data: { ...isaTemplate.data, predicate: "" },
    })),
    viewport: { x: 0, y: 0, zoom: 0.3 },
    settings: { grid: false, snap: false },
  };
  const largeStarted = Date.now();
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "large.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(largeDocument)),
    });
  await page.waitForFunction(
    () => document.querySelectorAll(".react-flow__node-studio").length === 220,
  );
  const largeRenderMs = Date.now() - largeStarted;
  const largeNodeCount = await page.locator(".react-flow__node-studio").count();
  const result = {
    starterNodes,
    starterEdges,
    doubleLineClear,
    panWorks,
    shiftSelectWorks,
    createdEdges,
    repeatedEdges,
    restoredEdges,
    canvasContextMenu,
    weakPaletteWorks,
    dragUndoGrouped,
    largeRenderMs,
    largeNodeCount,
    undoGrouped,
    isaEdges: document.edges.filter((e) => e.data.kind === "isa").length,
    participationEdges: document.edges.filter(
      (e) => e.data.kind === "participation",
    ).length,
    cancelledTitle: document.title === "Untitled diagram",
    title: await page.title(),
    svgHasLexend: svg.includes("font-family:Lexend"),
    svgHasDiamond: svg.includes("<polygon"),
    pngSignature: pngBytes.subarray(1, 4).toString(),
    pngWidth: pngBytes.readUInt32BE(16),
    errors,
  };
  console.log(JSON.stringify(result));
  if (
    errors.length ||
    starterNodes < 10 ||
    starterEdges < 9 ||
    !doubleLineClear ||
    !panWorks ||
    !shiftSelectWorks ||
    createdEdges !== 1 ||
    repeatedEdges !== 2 ||
    restoredEdges !== 3 ||
    !canvasContextMenu ||
    !weakPaletteWorks ||
    !dragUndoGrouped ||
    largeNodeCount !== 220 ||
    !undoGrouped ||
    result.isaEdges !== 1 ||
    result.participationEdges !== 2 ||
    !result.cancelledTitle ||
    !result.svgHasLexend ||
    !result.svgHasDiamond ||
    result.pngSignature !== "PNG" ||
    result.pngWidth < 640
  )
    throw new Error("Browser smoke test failed.");
} finally {
  await browser?.close();
  await server.close();
}
