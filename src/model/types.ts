import type { Edge, Node, Viewport } from "@xyflow/react";

export type NodeKind =
  | "entity"
  | "relationship"
  | "attribute"
  | "specialization"
  | "category"
  | "annotation";
export type EdgeKind =
  | "participation"
  | "attribute"
  | "isa"
  | "specialization-parent"
  | "specialization-child"
  | "category-source"
  | "category-target";
export type Completeness = "partial" | "total";
export type Constraint = "disjoint" | "overlap";
export type CardinalityMode = "ratio" | "minmax" | "none";
export interface AttributeSemantics {
  isKey: boolean;
  isPartialKey: boolean;
  isMultivalued: boolean;
  isDerived: boolean;
  isComposite: boolean;
}
export interface StudioNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
  notes: string;
  weak: boolean;
  identifying: boolean;
  attribute: AttributeSemantics;
  constraint: Constraint;
  completeness: Completeness;
  defining: string;
  fontSize: number;
  align: "left" | "center" | "right";
}
export interface StudioEdgeData extends Record<string, unknown> {
  kind: EdgeKind;
  participation: Completeness;
  cardinalityMode: CardinalityMode;
  ratio: string;
  minimum: string;
  maximum: string;
  role: string;
  predicate: string;
  notes: string;
  labelT: number;
  labelOffset: number;
  connector: "straight" | "orthogonal";
}
export type StudioNode = Node<StudioNodeData, "studio">;
export type StudioEdge = Edge<StudioEdgeData, "chen"> & {
  data: StudioEdgeData;
};
export interface StudioSettings {
  grid: boolean;
  snap: boolean;
}
export interface StudioDocument {
  version: 1;
  title: string;
  nodes: StudioNode[];
  edges: StudioEdge[];
  viewport: Viewport;
  settings: StudioSettings;
}

export const DEFAULT_ATTRIBUTE: AttributeSemantics = {
  isKey: false,
  isPartialKey: false,
  isMultivalued: false,
  isDerived: false,
  isComposite: false,
};
export const DEFAULT_SETTINGS: StudioSettings = { grid: true, snap: false };
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
const names: Record<NodeKind, string> = {
  entity: "ENTITY",
  relationship: "RELATIONSHIP",
  attribute: "Attribute",
  specialization: "d",
  category: "U",
  annotation: "Text annotation",
};
export function nodeData(kind: NodeKind): StudioNodeData {
  return {
    kind,
    name: names[kind],
    notes: "",
    weak: false,
    identifying: false,
    attribute: { ...DEFAULT_ATTRIBUTE },
    constraint: "disjoint",
    completeness: "partial",
    defining: "",
    fontSize: 16,
    align: "center",
  };
}
export function edgeData(kind: EdgeKind): StudioEdgeData {
  return {
    kind,
    participation: "partial",
    cardinalityMode: "ratio",
    ratio: "N",
    minimum: "0",
    maximum: "N",
    role: "",
    predicate: "",
    notes: "",
    labelT: kind === "participation" ? 0.28 : 0.5,
    labelOffset: 0,
    connector: "straight",
  };
}
export function makeNode(
  id: string,
  kind: NodeKind,
  x: number,
  y: number,
  patch: Partial<StudioNodeData> = {},
): StudioNode {
  return {
    id,
    type: "studio",
    position: { x, y },
    data: { ...nodeData(kind), ...patch },
    zIndex: 0,
    selected: false,
  };
}
export function makeEdge(
  id: string,
  source: string,
  target: string,
  kind: EdgeKind,
  patch: Partial<StudioEdgeData> = {},
): StudioEdge {
  return {
    id,
    type: "chen",
    source,
    target,
    data: { ...edgeData(kind), ...patch },
    selected: false,
    reconnectable: true,
  };
}
export function inferEdgeKind(a: NodeKind, b: NodeKind): EdgeKind | null {
  if (a === "attribute" && ["entity", "relationship", "attribute"].includes(b))
    return "attribute";
  if (b === "attribute" && ["entity", "relationship", "attribute"].includes(a))
    return "attribute";
  if (
    (a === "entity" && b === "relationship") ||
    (a === "relationship" && b === "entity")
  )
    return "participation";
  if (a === "entity" && b === "entity") return "isa";
  if (a === "entity" && b === "specialization") return "specialization-parent";
  if (a === "specialization" && b === "entity") return "specialization-child";
  if (a === "entity" && b === "category") return "category-source";
  if (a === "category" && b === "entity") return "category-target";
  return null;
}
export function normalizeConnection(
  source: StudioNode,
  target: StudioNode,
): { source: string; target: string; kind: EdgeKind } | null {
  const a = source.data.kind,
    b = target.data.kind;
  const kind = inferEdgeKind(a, b);
  if (!kind) return null;
  if (kind === "participation" && a === "relationship")
    return { source: target.id, target: source.id, kind };
  if (kind === "attribute" && a !== "attribute")
    return { source: target.id, target: source.id, kind };
  return { source: source.id, target: target.id, kind };
}
