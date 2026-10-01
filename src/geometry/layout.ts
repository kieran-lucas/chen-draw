import { center, nodeBox, nodeSize, type Point } from "./diagram";
import type { StudioEdge, StudioNode } from "../model/types";

/** Deterministic conceptual layout. Geometry changes; notation and connections stay intact. */
export function layoutNodes(
  nodes: StudioNode[],
  edges: StudioEdge[],
): StudioNode[] {
  const placed = new Map<string, StudioNode>();
  const reserve = (node: StudioNode, desired: Point) => {
    const size = nodeSize(node);
    const overlaps = (p: Point) =>
      [...placed.values()].some((other) => {
        const box = nodeBox(other);
        return (
          p.x < box.x + box.width + 32 &&
          p.x + size.width + 32 > box.x &&
          p.y < box.y + box.height + 32 &&
          p.y + size.height + 32 > box.y
        );
      });
    let position = desired;
    for (let attempt = 1; overlaps(position); attempt++) {
      const ring = Math.ceil(attempt / 8),
        angle = ((attempt % 8) * Math.PI) / 4;
      position = {
        x: desired.x + Math.cos(angle) * ring * 110,
        y: desired.y + Math.sin(angle) * ring * 110,
      };
    }
    placed.set(node.id, { ...node, position });
  };
  const entities = nodes.filter((n) => n.data.kind === "entity");
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const descendants = new Map<string, Set<string>>();
  const add = (source: string, target: string) => {
    if (
      source !== target &&
      byId.get(source)?.data.kind === "entity" &&
      byId.get(target)?.data.kind === "entity"
    )
      descendants.set(
        source,
        new Set([...(descendants.get(source) ?? []), target]),
      );
  };
  edges
    .filter((e) => e.data.kind === "isa")
    .forEach((e) => add(e.source, e.target));
  for (const group of nodes.filter((n) =>
    ["specialization", "category"].includes(n.data.kind),
  )) {
    const parents = edges.filter(
      (e) =>
        e.target === group.id &&
        ["specialization-parent", "category-source"].includes(e.data.kind),
    );
    const children = edges.filter(
      (e) =>
        e.source === group.id &&
        ["specialization-child", "category-target"].includes(e.data.kind),
    );
    parents.forEach((p) => children.forEach((c) => add(p.source, c.target)));
  }
  const incoming = new Map(entities.map((n) => [n.id, 0]));
  descendants.forEach((children) =>
    children.forEach((id) => incoming.set(id, (incoming.get(id) ?? 0) + 1)),
  );
  const queue = entities.filter((n) => !incoming.get(n.id)).map((n) => n.id);
  const ranks = new Map(entities.map((n) => [n.id, 0]));
  for (let i = 0; i < queue.length; i++) {
    const parent = queue[i];
    for (const child of descendants.get(parent) ?? []) {
      ranks.set(
        child,
        Math.max(ranks.get(child) ?? 0, (ranks.get(parent) ?? 0) + 1),
      );
      incoming.set(child, incoming.get(child)! - 1);
      if (!incoming.get(child)) queue.push(child);
    }
  }
  // Cycles remain editable and are reported by validation.
  const layers = new Map<number, StudioNode[]>();
  entities.forEach((n) => {
    const rank = ranks.get(n.id) ?? 0;
    layers.set(rank, [...(layers.get(rank) ?? []), n]);
  });
  let top = 100;
  [...layers.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([, layer]) => {
      layer.forEach((n, i) =>
        reserve(n, {
          x: 100 + (i % 4) * 400,
          y: top + Math.floor(i / 4) * 360,
        }),
      );
      top += Math.ceil(layer.length / 4) * 360;
    });
  const average = (ids: string[]) => {
    const points = [...new Set(ids)]
      .map((id) => placed.get(id))
      .filter((n): n is StudioNode => !!n)
      .map(center);
    return points.length
      ? {
          x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
          y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
        }
      : { x: 100, y: top };
  };
  for (const n of nodes.filter((n) =>
    ["relationship", "specialization", "category"].includes(n.data.kind),
  )) {
    const ids = edges
      .filter((e) => e.source === n.id || e.target === n.id)
      .map((e) => (e.source === n.id ? e.target : e.source));
    const at = average(ids),
      size = nodeSize(n);
    reserve(n, { x: at.x - size.width / 2, y: at.y - size.height / 2 });
  }
  const pending = nodes.filter((n) => n.data.kind === "attribute");
  const childCount = new Map<string, number>();
  while (pending.length) {
    let index = pending.findIndex((n) =>
      edges.some(
        (e) =>
          e.data.kind === "attribute" &&
          (e.source === n.id || e.target === n.id) &&
          placed.has(e.source === n.id ? e.target : e.source),
      ),
    );
    if (index < 0) index = 0;
    const [n] = pending.splice(index, 1);
    const ownerEdge = edges.find(
      (e) =>
        e.data.kind === "attribute" &&
        (e.source === n.id || e.target === n.id) &&
        placed.has(e.source === n.id ? e.target : e.source),
    );
    const ownerId =
      ownerEdge &&
      (ownerEdge.source === n.id ? ownerEdge.target : ownerEdge.source);
    const owner = ownerId ? placed.get(ownerId) : undefined;
    if (owner) {
      const ordinal = childCount.get(owner.id) ?? 0;
      childCount.set(owner.id, ordinal + 1);
      const angle = -Math.PI / 2 + (((ordinal % 5) - 2) * Math.PI) / 5;
      const p = center(owner),
        size = nodeSize(n),
        radius = 155 + Math.floor(ordinal / 5) * 100;
      reserve(n, {
        x: p.x + Math.cos(angle) * radius - size.width / 2,
        y: p.y + Math.sin(angle) * radius - size.height / 2,
      });
    } else reserve(n, { x: 100, y: top });
  }
  nodes
    .filter((n) => !placed.has(n.id))
    .forEach((n) => reserve(n, { x: 100, y: top + 160 }));
  return nodes.map((n) => placed.get(n.id)!);
}
