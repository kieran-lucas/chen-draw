import type { StudioEdge, StudioNode } from "../model/types";

export interface Point {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const textWidth = (text: string, size = 15, weight = 500) =>
  [...text].reduce(
    (sum, c) =>
      sum +
      (/[WM@]/.test(c) ? 0.9 : /[il.,:;!|]/.test(c) ? 0.3 : 0.61) *
        size *
        (weight >= 600 ? 1.04 : 1),
    0,
  );
export function nodeSize(n: StudioNode): { width: number; height: number } {
  const name = n.data.name || " ";
  if (n.data.kind === "entity")
    return {
      width: Math.max(120, Math.ceil(textWidth(name, 15, 600) + 32)),
      height: 52,
    };
  if (n.data.kind === "relationship")
    return {
      width: Math.max(130, Math.ceil(textWidth(name, 14, 600) + 76)),
      height: 76,
    };
  if (n.data.kind === "attribute")
    return {
      width: Math.max(112, Math.ceil(textWidth(name, 14) + 53)),
      height: 52,
    };
  if (n.data.kind === "annotation") {
    const lines = name.split("\n");
    return {
      width: Math.max(
        80,
        Math.ceil(
          Math.max(...lines.map((l) => textWidth(l, n.data.fontSize))) + 18,
        ),
      ),
      height: Math.max(32, lines.length * (n.data.fontSize + 7) + 8),
    };
  }
  return { width: 44, height: 44 };
}
export function nodeBox(n: StudioNode): Box {
  return { ...n.position, ...nodeSize(n) };
}
export function nodeRenderBox(n: StudioNode): Box {
  const box = nodeBox(n);
  if (n.data.kind !== "specialization" || !n.data.defining) return box;
  const labelWidth = Math.max(40, textWidth(n.data.defining, 12) + 8);
  const labelX = n.position.x + 22 - labelWidth / 2;
  const x = Math.min(box.x, labelX);
  return {
    x,
    y: n.position.y - 26,
    width: Math.max(box.x + box.width, labelX + labelWidth) - x,
    height: box.height + 26,
  };
}
export function center(n: StudioNode): Point {
  const b = nodeBox(n);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
function shapeRadii(n: StudioNode): { rx: number; ry: number } {
  const { width, height } = nodeSize(n);
  const inset = n.data.kind === "entity" ? 1 : 2;
  return { rx: width / 2 - inset, ry: height / 2 - inset };
}
function boundary(n: StudioNode, toward: Point): Point {
  const c = center(n),
    { rx, ry } = shapeRadii(n);
  const dx = toward.x - c.x,
    dy = toward.y - c.y;
  if (Math.abs(dx) + Math.abs(dy) < 0.001) return { x: c.x + rx, y: c.y };
  let scale: number;
  if (
    n.data.kind === "attribute" ||
    n.data.kind === "specialization" ||
    n.data.kind === "category"
  )
    scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  else if (n.data.kind === "relationship")
    scale = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
  else
    scale = Math.min(
      Math.abs(dx) < 0.001 ? Infinity : rx / Math.abs(dx),
      Math.abs(dy) < 0.001 ? Infinity : ry / Math.abs(dy),
    );
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}
function handleBoundary(
  n: StudioNode,
  handle: string | null | undefined,
  fallback: Point,
): Point {
  const side = handle?.match(/^[st]-([0-3])$/)?.[1];
  if (side === undefined) return boundary(n, fallback);
  const c = center(n),
    { rx, ry } = shapeRadii(n);
  if (side === "0") return { x: c.x, y: c.y - ry };
  if (side === "1") return { x: c.x + rx, y: c.y };
  if (side === "2") return { x: c.x, y: c.y + ry };
  return { x: c.x - rx, y: c.y };
}
export function edgeEndpoints(
  edge: StudioEdge,
  nodes: StudioNode[],
): { start: Point; end: Point } | null {
  const source = nodes.find((n) => n.id === edge.source),
    target = nodes.find((n) => n.id === edge.target);
  if (!source || !target) return null;
  return {
    start: handleBoundary(source, edge.sourceHandle, center(target)),
    end: handleBoundary(target, edge.targetHandle, center(source)),
  };
}
export function edgePoints(
  edge: StudioEdge,
  nodes: StudioNode[],
  edges: StudioEdge[],
): Point[] | null {
  const ends = edgeEndpoints(edge, nodes);
  if (!ends) return null;
  const siblings = edges.filter(
    (e) =>
      e.source === edge.source &&
      e.target === edge.target &&
      e.data.kind === edge.data.kind,
  );
  const ordinal = siblings.findIndex((e) => e.id === edge.id);
  const spread = (ordinal - (siblings.length - 1) / 2) * 16;
  const dx = ends.end.x - ends.start.x,
    dy = ends.end.y - ends.start.y,
    len = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / len, y: dx / len };
  const a = {
    x: ends.start.x + normal.x * spread,
    y: ends.start.y + normal.y * spread,
  };
  const b = {
    x: ends.end.x + normal.x * spread,
    y: ends.end.y + normal.y * spread,
  };
  if (edge.data.connector === "orthogonal") {
    if (Math.abs(b.x - a.x) > Math.abs(b.y - a.y)) {
      const mid = (a.x + b.x) / 2;
      return [a, { x: mid, y: a.y }, { x: mid, y: b.y }, b];
    }
    const mid = (a.y + b.y) / 2;
    return [a, { x: a.x, y: mid }, { x: b.x, y: mid }, b];
  }
  return [a, b];
}
const offsetLine = (points: Point[], offset: number): Point[] => {
  const normal = (a: Point, b: Point) => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  };
  return points.map((p, i) => {
    if (i === 0) {
      const n = normal(points[0], points[1]);
      return { x: p.x + n.x * offset, y: p.y + n.y * offset };
    }
    if (i === points.length - 1) {
      const n = normal(points[i - 1], points[i]);
      return { x: p.x + n.x * offset, y: p.y + n.y * offset };
    }
    const before = normal(points[i - 1], p),
      after = normal(p, points[i + 1]);
    const factor =
      offset / Math.max(0.2, 1 + before.x * after.x + before.y * after.y);
    return {
      x: p.x + (before.x + after.x) * factor,
      y: p.y + (before.y + after.y) * factor,
    };
  });
};
const path = (points: Point[]) =>
  `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`;
export function edgeIsDouble(e: StudioEdge, nodes: StudioNode[]): boolean {
  if (e.data.kind === "participation") return e.data.participation === "total";
  if (e.data.kind === "specialization-parent")
    return nodes.find((n) => n.id === e.target)?.data.completeness === "total";
  if (e.data.kind === "category-target")
    return nodes.find((n) => n.id === e.source)?.data.completeness === "total";
  return false;
}
export function edgeLabel(e: StudioEdge): string {
  if (e.data.kind === "participation")
    return e.data.cardinalityMode === "ratio"
      ? e.data.ratio
      : e.data.cardinalityMode === "minmax"
        ? `(${e.data.minimum},${e.data.maximum})`
        : "";
  if (e.data.kind === "isa") return e.data.predicate;
  return "";
}
export function labelPosition(e: StudioEdge, points: Point[]): Point {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let remaining =
    lengths.reduce((sum, length) => sum + length, 0) *
    Math.max(0, Math.min(1, e.data.labelT));
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i];
    if (length < 0.001) continue;
    if (remaining <= length || i === lengths.length - 1) {
      const a = points[i],
        b = points[i + 1],
        t = remaining / length;
      return {
        x: a.x + (b.x - a.x) * t - ((b.y - a.y) / length) * e.data.labelOffset,
        y: a.y + (b.y - a.y) * t + ((b.x - a.x) / length) * e.data.labelOffset,
      };
    }
    remaining -= length;
  }
  return points[0];
}
function labelBox(value: string, at: Point): Box {
  const lines = value.split("\n"),
    width = Math.max(28, ...lines.map((line) => textWidth(line, 12) + 12)),
    height = lines.length * 17 + 5;
  return { x: at.x - width / 2, y: at.y - height / 2, width, height };
}
export function edgeLabelBoxes(
  e: StudioEdge,
  nodes: StudioNode[],
  edges: StudioEdge[],
): Box[] {
  const points = edgePoints(e, nodes, edges);
  if (!points) return [];
  const label = edgeLabel(e),
    role = e.data.kind === "participation" ? e.data.role : "";
  const position = labelPosition(e, points);
  const boxes: Box[] = [];
  if (label) boxes.push(labelBox(label, position));
  if (role)
    boxes.push(
      labelBox(role, {
        x: position.x,
        y: position.y - (label ? label.split("\n").length * 9 + 16 : 0),
      }),
    );
  return boxes;
}
export function edgeMarkup(
  e: StudioEdge,
  nodes: StudioNode[],
  edges: StudioEdge[],
): string {
  const pts = edgePoints(e, nodes, edges);
  if (!pts) return "";
  const isDouble = edgeIsDouble(e, nodes);
  const paths = isDouble
    ? [-4.25, 4.25].map((offset) => {
        const shifted = offsetLine(pts, offset),
          source = nodes.find((n) => n.id === e.source),
          target = nodes.find((n) => n.id === e.target);
        if (source) shifted[0] = boundary(source, shifted[0]);
        if (target)
          shifted[shifted.length - 1] = boundary(
            target,
            shifted[shifted.length - 1],
          );
        return path(shifted);
      })
    : [path(pts)];
  const strokes = paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#222a32" stroke-width="${isDouble ? 1.6 : 1.8}" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join("");
  const label = edgeLabel(e),
    role = e.data.kind === "participation" ? e.data.role : "";
  const p = labelPosition(e, pts),
    roleP = {
      x: p.x,
      y: p.y - (label ? label.split("\n").length * 9 + 16 : 0),
    };
  const drawLabel = (value: string, at: Point) => {
    if (!value) return "";
    const lines = value.split("\n"),
      box = labelBox(value, at);
    const texts = lines
      .map(
        (line, i) =>
          `<text x="${at.x}" y="${at.y - (lines.length - 1) * 8.5 + i * 17}" text-anchor="middle" dominant-baseline="middle" font-family="Lexend, sans-serif" font-size="12" font-weight="500" fill="#222a32">${escapeXml(line)}</text>`,
      )
      .join("");
    return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="2" fill="white"/>${texts}</g>`;
  };
  return strokes + drawLabel(label, p) + drawLabel(role, roleP);
}
export function shapeMarkup(n: StudioNode): string {
  const { width: w, height: h } = nodeSize(n),
    cx = w / 2,
    cy = h / 2,
    name = escapeXml(n.data.name);
  const stroke = "#222a32",
    common = `fill="white" stroke="${stroke}" stroke-width="1.8"`;
  const text = (
    value: string,
    x: number,
    y: number,
    size = 15,
    weight = 500,
    anchor = "middle",
  ) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-family="Lexend, sans-serif" font-size="${size}" font-weight="${weight}" fill="${stroke}">${value}</text>`;
  if (n.data.kind === "entity")
    return `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" ${common}/>${n.data.weak ? `<rect x="7" y="7" width="${w - 14}" height="${h - 14}" fill="none" stroke="${stroke}" stroke-width="1.7"/>` : ""}${text(name, cx, cy, 15, 600)}`;
  if (n.data.kind === "relationship") {
    const diamond = (inset: number) =>
      `${cx} ${inset}, ${w - inset} ${cy}, ${cx} ${h - inset}, ${inset} ${cy}`;
    return `<polygon points="${diamond(2)}" ${common}/>${n.data.identifying ? `<polygon points="${diamond(10)}" fill="none" stroke="${stroke}" stroke-width="1.7"/>` : ""}${text(name, cx, cy, 14, 600)}`;
  }
  if (n.data.kind === "attribute") {
    const oval = `<ellipse cx="${cx}" cy="${cy}" rx="${cx - 2}" ry="${cy - 2}" ${common}${n.data.attribute.isDerived ? ' stroke-dasharray="6 4"' : ""}/>`;
    const inner = n.data.attribute.isMultivalued
      ? `<ellipse cx="${cx}" cy="${cy}" rx="${cx - 8}" ry="${cy - 8}" fill="none" stroke="${stroke}" stroke-width="1.7"${n.data.attribute.isDerived ? ' stroke-dasharray="6 4"' : ""}/>`
      : "";
    const key = n.data.attribute.isKey
      ? `<line x1="${cx - textWidth(n.data.name, 14) / 2}" x2="${cx + textWidth(n.data.name, 14) / 2}" y1="${cy + 8}" y2="${cy + 8}" stroke="${stroke}" stroke-width="1.2"/>`
      : "";
    const partial = n.data.attribute.isPartialKey
      ? `<line x1="${cx - textWidth(n.data.name, 14) / 2}" x2="${cx + textWidth(n.data.name, 14) / 2}" y1="${cy + (n.data.attribute.isKey ? 11 : 8)}" y2="${cy + (n.data.attribute.isKey ? 11 : 8)}" stroke="${stroke}" stroke-width="1.2" stroke-dasharray="3 2"/>`
      : "";
    return `${oval}${inner}${text(name, cx, cy, 14, 500)}${key}${partial}`;
  }
  if (n.data.kind === "specialization" || n.data.kind === "category") {
    const letter =
      n.data.kind === "category"
        ? "U"
        : n.data.constraint === "disjoint"
          ? "d"
          : "o";
    return `<circle cx="22" cy="22" r="20" ${common}/>${text(letter, 22, 22, 19, 600)}${n.data.kind === "specialization" && n.data.defining ? `<rect x="${22 - Math.max(40, textWidth(n.data.defining, 12) + 8) / 2}" y="-26" width="${Math.max(40, textWidth(n.data.defining, 12) + 8)}" height="19" fill="white"/>${text(escapeXml(n.data.defining), 22, -16, 12, 400)}` : ""}`;
  }
  const lines = n.data.name.split("\n"),
    fs = n.data.fontSize,
    anchor =
      n.data.align === "left"
        ? "start"
        : n.data.align === "right"
          ? "end"
          : "middle",
    x = n.data.align === "left" ? 4 : n.data.align === "right" ? w - 4 : cx;
  return lines
    .map((line, i) =>
      text(escapeXml(line), x, 8 + fs / 2 + i * (fs + 7), fs, 400, anchor),
    )
    .join("");
}
