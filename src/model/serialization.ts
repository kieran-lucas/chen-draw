import {
  DEFAULT_SETTINGS,
  DEFAULT_VIEWPORT,
  edgeData,
  nodeData,
  type EdgeKind,
  type NodeKind,
  type StudioDocument,
  type StudioEdge,
  type StudioNode,
} from "./types";

const nodeKinds: NodeKind[] = [
  "entity",
  "relationship",
  "attribute",
  "specialization",
  "category",
  "annotation",
];
const edgeKinds: EdgeKind[] = [
  "participation",
  "attribute",
  "isa",
  "specialization-parent",
  "specialization-child",
  "category-source",
  "category-target",
];
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;
const choice = <T extends string>(
  v: unknown,
  options: readonly T[],
  fallback: T,
): T => (options.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback = false) =>
  typeof v === "boolean" ? v : fallback;

export function cleanDocument(document: StudioDocument): StudioDocument {
  return {
    version: 1,
    title: document.title,
    nodes: document.nodes.map((n) => ({
      id: n.id,
      type: "studio" as const,
      position: { ...n.position },
      data: structuredClone(n.data),
      zIndex: n.zIndex ?? 0,
    })),
    edges: document.edges.map((e) => ({
      id: e.id,
      type: "chen" as const,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: structuredClone(e.data),
    })),
    viewport: { ...document.viewport },
    settings: { ...document.settings },
  };
}

export function parseDocument(input: unknown): StudioDocument {
  if (
    !record(input) ||
    input.version !== 1 ||
    !Array.isArray(input.nodes) ||
    !Array.isArray(input.edges)
  )
    throw new Error("This is not a Chen Studio version 1 diagram.");
  const nodes: StudioNode[] = input.nodes.map((raw, index) => {
    if (
      !record(raw) ||
      typeof raw.id !== "string" ||
      !record(raw.position) ||
      !finite(raw.position.x) ||
      !finite(raw.position.y) ||
      !record(raw.data)
    )
      throw new Error(`Node ${index + 1} is invalid.`);
    const kind = raw.data.kind;
    if (!nodeKinds.includes(kind as NodeKind))
      throw new Error(`Node ${index + 1} has an unknown type.`);
    const base = nodeData(kind as NodeKind);
    const a = record(raw.data.attribute) ? raw.data.attribute : {};
    return {
      id: raw.id,
      type: "studio",
      position: { x: raw.position.x, y: raw.position.y },
      zIndex: finite(raw.zIndex)
        ? raw.zIndex
        : finite(raw.data.z)
          ? raw.data.z
          : 0,
      data: {
        ...base,
        name: str(raw.data.name, base.name),
        notes: str(raw.data.notes),
        weak: bool(raw.data.weak),
        identifying: bool(raw.data.identifying),
        attribute: {
          isKey: bool(a.isKey),
          isPartialKey: bool(a.isPartialKey),
          isMultivalued: bool(a.isMultivalued),
          isDerived: bool(a.isDerived),
          isComposite: bool(a.isComposite),
        },
        constraint: choice(
          raw.data.constraint,
          ["disjoint", "overlap"],
          "disjoint",
        ),
        completeness: choice(
          raw.data.completeness,
          ["partial", "total"],
          "partial",
        ),
        defining: str(raw.data.defining),
        fontSize: finite(raw.data.fontSize)
          ? Math.max(9, Math.min(48, raw.data.fontSize))
          : 16,
        align: choice(raw.data.align, ["left", "center", "right"], "center"),
      },
    };
  });
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length)
    throw new Error("The diagram contains duplicate node IDs.");
  const edges: StudioEdge[] = input.edges.map((raw, index) => {
    if (
      !record(raw) ||
      typeof raw.id !== "string" ||
      typeof raw.source !== "string" ||
      typeof raw.target !== "string" ||
      !ids.has(raw.source) ||
      !ids.has(raw.target) ||
      !record(raw.data)
    )
      throw new Error(`Connector ${index + 1} is invalid.`);
    if (!edgeKinds.includes(raw.data.kind as EdgeKind))
      throw new Error(`Connector ${index + 1} has an unknown type.`);
    const base = edgeData(raw.data.kind as EdgeKind);
    return {
      id: raw.id,
      type: "chen",
      source: raw.source,
      target: raw.target,
      sourceHandle:
        typeof raw.sourceHandle === "string" ? raw.sourceHandle : undefined,
      targetHandle:
        typeof raw.targetHandle === "string" ? raw.targetHandle : undefined,
      data: {
        ...base,
        participation: choice(
          raw.data.participation,
          ["partial", "total"],
          "partial",
        ),
        cardinalityMode: choice(
          raw.data.cardinalityMode,
          ["ratio", "minmax", "none"],
          "ratio",
        ),
        ratio: str(raw.data.ratio, "N"),
        minimum: str(raw.data.minimum, "0"),
        maximum: str(raw.data.maximum, "N"),
        role: str(raw.data.role),
        predicate: str(raw.data.predicate),
        notes: str(raw.data.notes),
        labelT: finite(raw.data.labelT)
          ? Math.max(0.05, Math.min(0.95, raw.data.labelT))
          : base.labelT,
        labelOffset: finite(raw.data.labelOffset) ? raw.data.labelOffset : 0,
        connector: choice(
          raw.data.connector,
          ["straight", "orthogonal"],
          "straight",
        ),
      },
    };
  });
  if (new Set(edges.map((e) => e.id)).size !== edges.length)
    throw new Error("The diagram contains duplicate connector IDs.");
  const vp = record(input.viewport) ? input.viewport : {};
  const settings = record(input.settings) ? input.settings : {};
  return {
    version: 1,
    title: str(input.title, "Untitled diagram"),
    nodes,
    edges,
    viewport: {
      x: finite(vp.x) ? vp.x : DEFAULT_VIEWPORT.x,
      y: finite(vp.y) ? vp.y : DEFAULT_VIEWPORT.y,
      zoom: finite(vp.zoom) && vp.zoom > 0 ? vp.zoom : 1,
    },
    settings: {
      grid: bool(settings.grid, DEFAULT_SETTINGS.grid),
      snap: bool(settings.snap, DEFAULT_SETTINGS.snap),
    },
  };
}
