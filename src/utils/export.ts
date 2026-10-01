import font400 from "@fontsource/lexend/files/lexend-latin-400-normal.woff2?url";
import font500 from "@fontsource/lexend/files/lexend-latin-500-normal.woff2?url";
import font600 from "@fontsource/lexend/files/lexend-latin-600-normal.woff2?url";
import font700 from "@fontsource/lexend/files/lexend-latin-700-normal.woff2?url";
import ext400 from "@fontsource/lexend/files/lexend-latin-ext-400-normal.woff2?url";
import ext500 from "@fontsource/lexend/files/lexend-latin-ext-500-normal.woff2?url";
import ext600 from "@fontsource/lexend/files/lexend-latin-ext-600-normal.woff2?url";
import ext700 from "@fontsource/lexend/files/lexend-latin-ext-700-normal.woff2?url";
import viet400 from "@fontsource/lexend/files/lexend-vietnamese-400-normal.woff2?url";
import viet500 from "@fontsource/lexend/files/lexend-vietnamese-500-normal.woff2?url";
import viet600 from "@fontsource/lexend/files/lexend-vietnamese-600-normal.woff2?url";
import viet700 from "@fontsource/lexend/files/lexend-vietnamese-700-normal.woff2?url";
import {
  edgeMarkup,
  edgeLabelBoxes,
  nodeRenderBox,
  shapeMarkup,
  escapeXml,
} from "../geometry/diagram";
import type { StudioDocument } from "../model/types";

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
const basename = (title: string) =>
  (
    title
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/^-|-$/g, "") || "chen-diagram"
  ).toLowerCase();
let cachedFonts: Promise<string> | null = null;
function fontCss(): Promise<string> {
  if (!cachedFonts)
    cachedFonts = loadFontCss().catch((error) => {
      cachedFonts = null;
      throw error;
    });
  return cachedFonts;
}
async function loadFontCss(): Promise<string> {
  const latin =
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  const latinExt =
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
  const vietnamese =
    "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB";
  const fonts = [
    [400, viet400, vietnamese],
    [400, ext400, latinExt],
    [400, font400, latin],
    [500, viet500, vietnamese],
    [500, ext500, latinExt],
    [500, font500, latin],
    [600, viet600, vietnamese],
    [600, ext600, latinExt],
    [600, font600, latin],
    [700, viet700, vietnamese],
    [700, ext700, latinExt],
    [700, font700, latin],
  ] as const;
  const entries = await Promise.all(
    fonts.map(async ([weight, url, range]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not load Lexend for export.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return `@font-face{font-family:Lexend;src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2');font-weight:${weight};font-style:normal;unicode-range:${range}}`;
    }),
  );
  return entries.join("");
}
export async function makeSvg(
  doc: StudioDocument,
): Promise<{ svg: string; width: number; height: number }> {
  const boxes = [
    ...doc.nodes.map(nodeRenderBox),
    ...doc.edges.flatMap((e) => edgeLabelBoxes(e, doc.nodes, doc.edges)),
  ];
  const padding = 76;
  const minX = boxes.length ? Math.min(...boxes.map((b) => b.x)) - padding : 0;
  const minY = boxes.length ? Math.min(...boxes.map((b) => b.y)) - padding : 0;
  const maxX = boxes.length
    ? Math.max(...boxes.map((b) => b.x + b.width)) + padding
    : 800;
  const maxY = boxes.length
    ? Math.max(...boxes.map((b) => b.y + b.height)) + padding
    : 600;
  const width = Math.max(320, Math.ceil(maxX - minX)),
    height = Math.max(220, Math.ceil(maxY - minY));
  const fonts = await fontCss();
  const edgeLayer = doc.edges
    .map((e) => edgeMarkup(e, doc.nodes, doc.edges))
    .join("");
  const nodeLayer = [...doc.nodes]
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map(
      (n) =>
        `<g transform="translate(${n.position.x} ${n.position.y})">${shapeMarkup(n)}</g>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(doc.title)}"><defs><style>${fonts}text{font-family:Lexend,sans-serif}</style></defs><rect width="100%" height="100%" fill="white"/><g transform="translate(${-minX} ${-minY})">${edgeLayer}${nodeLayer}</g></svg>`;
  return { svg, width, height };
}
export async function exportSvg(doc: StudioDocument) {
  const { svg } = await makeSvg(doc);
  download(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    `${basename(doc.title)}.svg`,
  );
}
export async function exportPng(doc: StudioDocument) {
  const { svg, width, height } = await makeSvg(doc);
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      2,
      16384 / width,
      16384 / height,
      Math.sqrt(32_000_000 / (width * height)),
    );
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas export is unavailable.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed."))),
        "image/png",
      ),
    );
    download(blob, `${basename(doc.title)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
