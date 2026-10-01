import { inferEdgeKind, type StudioEdge, type StudioNode } from "./types";

export interface Warning {
  id: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}
export function validateGraph(
  nodes: StudioNode[],
  edges: StudioEdge[],
): Warning[] {
  const warnings: Warning[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, StudioEdge[]>();
  for (const edge of edges) {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge]);
    if (edge.source !== edge.target)
      adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge]);
  }
  const connected = (id: string, kind?: string) =>
    (adjacency.get(id) ?? []).filter((e) => !kind || e.data.kind === kind);
  const other = (e: StudioEdge, id: string) =>
    byId.get(e.source === id ? e.target : e.source);
  const ownedAttributes = new Set<string>();
  const ownerQueue = nodes
    .filter((n) => ["entity", "relationship"].includes(n.data.kind))
    .map((n) => n.id);
  for (let i = 0; i < ownerQueue.length; i++) {
    for (const e of connected(ownerQueue[i], "attribute")) {
      const neighbor = other(e, ownerQueue[i]);
      if (
        neighbor?.data.kind === "attribute" &&
        !ownedAttributes.has(neighbor.id)
      ) {
        ownedAttributes.add(neighbor.id);
        ownerQueue.push(neighbor.id);
      }
    }
  }
  const add = (id: string, message: string, nodeId?: string, edgeId?: string) =>
    warnings.push({ id, message, nodeId, edgeId });
  const names = new Map<string, string>();
  for (const n of nodes) {
    if (
      ["entity", "relationship", "attribute"].includes(n.data.kind) &&
      !n.data.name.trim()
    )
      add(`name-${n.id}`, "This element needs a name.", n.id);
    if (
      n.data.kind !== "annotation" &&
      n.data.kind !== "specialization" &&
      n.data.kind !== "category"
    ) {
      const name = n.data.name.trim().toLowerCase();
      const owner =
        n.data.kind === "attribute"
          ? connected(n.id, "attribute")
              .map((e) => (e.source === n.id ? e.target : e.source))
              .sort()
              .join(",")
          : "";
      const key = `${n.data.kind}:${owner}:${name}`;
      if (name && names.has(key))
        add(
          `duplicate-${n.id}`,
          `“${n.data.name}” is duplicated in the same context.`,
          n.id,
        );
      else names.set(key, n.id);
    }
    if (
      n.data.kind === "entity" &&
      n.data.weak &&
      !connected(n.id, "participation").some(
        (e) => other(e, n.id)?.data.identifying,
      )
    )
      add(
        `weak-${n.id}`,
        `${n.data.name}: weak entity has no identifying relationship.`,
        n.id,
      );
    if (n.data.kind === "relationship") {
      const participations = connected(n.id, "participation").filter(
        (e) => other(e, n.id)?.data.kind === "entity",
      );
      if (participations.length < 2)
        add(
          `relationship-${n.id}`,
          `${n.data.name}: relationship has fewer than two participations.`,
          n.id,
        );
      if (
        n.data.identifying &&
        !participations.some((e) => other(e, n.id)?.data.weak)
      )
        add(
          `identifying-${n.id}`,
          `${n.data.name}: identifying relationship has no weak entity.`,
          n.id,
        );
    }
    if (n.data.kind === "attribute" && !ownedAttributes.has(n.id))
      add(`attribute-${n.id}`, `${n.data.name}: attribute has no owner.`, n.id);
    if (
      n.data.kind === "attribute" &&
      n.data.attribute.isKey &&
      n.data.attribute.isPartialKey
    )
      add(
        `attribute-key-${n.id}`,
        `${n.data.name}: key and partial key underlines should not be combined.`,
        n.id,
      );
    if (n.data.kind === "specialization") {
      const parent = connected(n.id).filter(
        (e) => e.target === n.id && e.data.kind === "specialization-parent",
      );
      const children = connected(n.id).filter(
        (e) => e.source === n.id && e.data.kind === "specialization-child",
      );
      if (!parent.length)
        add(`spec-parent-${n.id}`, "Specialization has no superclass.", n.id);
      if (parent.length > 1)
        add(
          `spec-multi-${n.id}`,
          "Specialization has multiple superclasses. Use direct IS-A links for shared subclasses.",
          n.id,
        );
      if (!children.length)
        add(`spec-child-${n.id}`, "Specialization has no subclasses.", n.id);
    }
    if (n.data.kind === "category") {
      const sources = connected(n.id).filter(
        (e) => e.target === n.id && e.data.kind === "category-source",
      );
      const targets = connected(n.id).filter(
        (e) => e.source === n.id && e.data.kind === "category-target",
      );
      if (new Set(sources.map((e) => e.source)).size < 2)
        add(
          `category-source-${n.id}`,
          "Category needs at least two source entity types.",
          n.id,
        );
      if (targets.length !== 1)
        add(
          `category-target-${n.id}`,
          "Category needs one target entity type.",
          n.id,
        );
    }
  }
  const isa = new Map<string, string[]>();
  for (const e of edges) {
    const source = byId.get(e.source),
      target = byId.get(e.target);
    if (!source || !target) {
      add(
        `missing-${e.id}`,
        "Connector has a missing endpoint.",
        undefined,
        e.id,
      );
      continue;
    }
    if (e.source === e.target)
      add(
        `self-edge-${e.id}`,
        "Connect distinct elements. Recursive relationships use two participations to a diamond.",
        undefined,
        e.id,
      );
    if (
      ["participation", "attribute", "isa"].includes(e.data.kind) &&
      inferEdgeKind(source.data.kind, target.data.kind) !== e.data.kind
    )
      add(
        `type-${e.id}`,
        "Connector type does not match its endpoint shapes.",
        undefined,
        e.id,
      );
    if (e.data.kind === "participation") {
      const entity = source.data.kind === "entity" ? source : target;
      const relationship =
        source.data.kind === "relationship" ? source : target;
      if (
        entity.data.weak &&
        relationship.data.identifying &&
        e.data.participation !== "total"
      )
        add(
          `weak-total-${e.id}`,
          `${entity.data.name}: participation in its identifying relationship must be total.`,
          undefined,
          e.id,
        );
      if (e.data.cardinalityMode === "ratio" && !e.data.ratio.trim())
        add(`ratio-${e.id}`, "Participation ratio is empty.", undefined, e.id);
      if (e.data.cardinalityMode === "minmax") {
        const minimum = e.data.minimum.trim(),
          maximum = e.data.maximum.trim();
        const validMin =
          /^\d+$/.test(minimum) && Number.isSafeInteger(Number(minimum));
        const validMax =
          (/^\d+$/.test(maximum) &&
            Number.isSafeInteger(Number(maximum)) &&
            Number(maximum) > 0) ||
          /^(N|M|\*|∞)$/i.test(maximum);
        if (!validMin || !validMax)
          add(
            `minmax-format-${e.id}`,
            "Min–max needs a nonnegative integer minimum and a positive integer or N/M/*/∞ maximum.",
            undefined,
            e.id,
          );
        else {
          if (/^\d+$/.test(maximum) && Number(minimum) > Number(maximum))
            add(
              `minmax-order-${e.id}`,
              "Minimum participation exceeds maximum participation.",
              undefined,
              e.id,
            );
          if (
            (Number(minimum) === 0 && e.data.participation === "total") ||
            (Number(minimum) > 0 && e.data.participation === "partial")
          )
            add(
              `minmax-total-${e.id}`,
              "Minimum 0 means partial participation; a positive minimum means total participation.",
              undefined,
              e.id,
            );
        }
      }
    }
    if (e.data.kind === "isa" || e.data.kind === "specialization-child") {
      const parent =
        e.data.kind === "isa"
          ? e.source
          : connected(e.source).find(
              (x) =>
                x.target === e.source &&
                x.data.kind === "specialization-parent",
            )?.source;
      if (parent) isa.set(parent, [...(isa.get(parent) ?? []), e.target]);
    }
    const a = byId.get(e.source)?.data.kind,
      b = byId.get(e.target)?.data.kind;
    if (
      (e.data.kind === "category-source" &&
        (a !== "entity" || b !== "category")) ||
      (e.data.kind === "category-target" &&
        (a !== "category" || b !== "entity"))
    )
      add(
        `category-misuse-${e.id}`,
        "Category connectors must join entity types through a U circle.",
        undefined,
        e.id,
      );
    if (
      (e.data.kind === "specialization-parent" &&
        (a !== "entity" || b !== "specialization")) ||
      (e.data.kind === "specialization-child" &&
        (a !== "specialization" || b !== "entity"))
    )
      add(
        `specialization-misuse-${e.id}`,
        "Specialization connectors must join entity types through a d/o circle.",
        undefined,
        e.id,
      );
  }
  // Iterative strongly connected components avoid recursive stack limits on large models.
  const visited = new Set<string>(),
    order: string[] = [],
    reverse = new Map<string, string[]>();
  isa.forEach((children, parent) =>
    children.forEach((child) =>
      reverse.set(child, [...(reverse.get(child) ?? []), parent]),
    ),
  );
  for (const n of nodes.filter((n) => n.data.kind === "entity")) {
    if (visited.has(n.id)) continue;
    const stack: { id: string; exit: boolean }[] = [{ id: n.id, exit: false }];
    while (stack.length) {
      const current = stack.pop()!;
      if (current.exit) {
        order.push(current.id);
        continue;
      }
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      stack.push({ id: current.id, exit: true });
      for (const child of isa.get(current.id) ?? [])
        if (!visited.has(child)) stack.push({ id: child, exit: false });
    }
  }
  const assigned = new Set<string>();
  for (const root of order.reverse()) {
    if (assigned.has(root)) continue;
    const component: string[] = [],
      stack = [root];
    assigned.add(root);
    while (stack.length) {
      const id = stack.pop()!;
      component.push(id);
      for (const parent of reverse.get(id) ?? [])
        if (!assigned.has(parent)) {
          assigned.add(parent);
          stack.push(parent);
        }
    }
    if (component.length > 1 || isa.get(root)?.includes(root)) {
      for (const id of component) {
        const n = byId.get(id);
        if (n)
          add(
            `cycle-${id}`,
            `${n.data.name} participates in an inheritance cycle.`,
            id,
          );
      }
    }
  }
  return warnings;
}
