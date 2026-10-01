import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import { create } from "zustand";
import { nodeSize } from "../geometry/diagram";
import { layoutNodes } from "../geometry/layout";
import { cleanDocument, parseDocument } from "../model/serialization";
import { starterDocument } from "../model/starter";
import {
  makeEdge,
  makeNode,
  normalizeConnection,
  type NodeKind,
  type StudioDocument,
  type StudioEdge,
  type StudioEdgeData,
  type StudioNode,
  type StudioNodeData,
  type StudioSettings,
} from "../model/types";
import { newId } from "../utils/id";

const STORAGE = "chen-studio-document-v1";
type Snapshot = Pick<
  StudioDocument,
  "title" | "nodes" | "edges" | "viewport" | "settings"
>;
type Clipboard = { nodes: StudioNode[]; edges: StudioEdge[] };
const snapshot = (
  s: Pick<EditorState, "title" | "nodes" | "edges" | "viewport" | "settings">,
): Snapshot => ({
  title: s.title,
  viewport: { ...s.viewport },
  settings: { ...s.settings },
  nodes: s.nodes.map((n) => ({
    id: n.id,
    type: "studio",
    position: { ...n.position },
    data: structuredClone(n.data),
    zIndex: n.zIndex ?? 0,
  })),
  edges: s.edges.map((e) => ({
    id: e.id,
    type: "chen",
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    data: structuredClone(e.data),
  })),
});
let loadError: string | null = null;
let loadedFromStorage = false;
const load = (): StudioDocument => {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const document = parseDocument(JSON.parse(raw) as unknown);
      loadedFromStorage = true;
      return document;
    }
    return starterDocument();
  } catch {
    loadError =
      "Saved diagram could not be loaded. A starter diagram is shown.";
    return starterDocument();
  }
};
const initial = load();

interface EditorState extends StudioDocument {
  past: Snapshot[];
  future: Snapshot[];
  gesture: Snapshot | null;
  clipboard: Clipboard | null;
  pasteCount: number;
  activeTool: NodeKind | "isa" | null;
  toolPatch: Partial<StudioNodeData>;
  editingId: string | null;
  status: "saved" | "saving" | "error";
  message: string | null;
  setMessage: (message: string | null) => void;
  setStatus: (status: "saved" | "saving" | "error") => void;
  setTitle: (title: string) => void;
  setViewport: (viewport: Viewport) => void;
  setSettings: (settings: Partial<StudioSettings>) => void;
  setTool: (
    tool: NodeKind | "isa" | null,
    patch?: Partial<StudioNodeData>,
  ) => void;
  setEditing: (id: string | null) => void;
  addNode: (
    kind: NodeKind,
    x: number,
    y: number,
    patch?: Partial<StudioNodeData>,
  ) => string;
  connect: (
    source: string,
    target: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ) => boolean;
  addEdge: (edge: StudioEdge) => void;
  reconnect: (
    edgeId: string,
    source: string,
    target: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ) => boolean;
  updateNode: (id: string, patch: Partial<StudioNodeData>) => void;
  updateEdge: (id: string, patch: Partial<StudioEdgeData>) => void;
  applyNodes: (changes: NodeChange<StudioNode>[]) => void;
  applyEdges: (changes: EdgeChange<StudioEdge>[]) => void;
  beginGesture: () => void;
  endGesture: () => void;
  removeSelected: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectNode: (id: string) => void;
  selectEdge: (id: string) => void;
  copy: () => void;
  paste: (x?: number, y?: number) => void;
  duplicate: () => void;
  insertTemplate: (document: StudioDocument, x: number, y: number) => void;
  arrange: () => void;
  nudge: (x: number, y: number) => void;
  addRelatedNode: (
    ownerId: string,
    kind: NodeKind,
    patch?: Partial<StudioNodeData>,
  ) => string | null;
  align: (
    mode:
      | "left"
      | "center"
      | "right"
      | "top"
      | "middle"
      | "bottom"
      | "distribute-h"
      | "distribute-v",
  ) => void;
  reorder: (id: string, direction: "front" | "back") => void;
  undo: () => void;
  redo: () => void;
  replaceDocument: (document: StudioDocument) => void;
  newDocument: () => void;
  saveNow: () => void;
}
const mark = (
  s: EditorState,
  next: Partial<EditorState>,
): Partial<EditorState> => ({
  ...next,
  past: [...s.past.slice(-99), snapshot(s)],
  future: [],
  status: "saving",
});
const selectedNodes = (s: EditorState) => s.nodes.filter((n) => n.selected);

export const useEditor = create<EditorState>((set, get) => ({
  ...initial,
  past: [],
  future: [],
  gesture: null,
  clipboard: null,
  pasteCount: 0,
  activeTool: null,
  toolPatch: {},
  editingId: null,
  status: "saved",
  message: loadError,
  setMessage: (message) => set({ message }),
  setStatus: (status) => set({ status }),
  setTitle: (title) =>
    set((s) => (s.title === title ? {} : mark(s, { title }))),
  setViewport: (viewport) => set({ viewport, status: "saving" }),
  setSettings: (settings) =>
    set((s) =>
      mark(s, {
        settings: { ...s.settings, ...settings },
      }),
    ),
  setTool: (activeTool, toolPatch = {}) => set({ activeTool, toolPatch }),
  setEditing: (editingId) => set({ editingId }),
  addNode: (kind, x, y, patch) => {
    const id = newId();
    set((s) =>
      mark(s, {
        nodes: [
          ...s.nodes.map((n) => ({ ...n, selected: false })),
          {
            ...makeNode(
              id,
              kind,
              s.settings.snap ? Math.round(x / 20) * 20 : x,
              s.settings.snap ? Math.round(y / 20) * 20 : y,
              patch,
            ),
            selected: true,
          },
        ],
        edges: s.edges.map((e) => ({ ...e, selected: false })),
      }),
    );
    return id;
  },
  connect: (sourceId, targetId, sourceHandle, targetHandle) => {
    const s = get(),
      source = s.nodes.find((n) => n.id === sourceId),
      target = s.nodes.find((n) => n.id === targetId);
    if (!source || !target || sourceId === targetId) {
      set({ message: "Choose two different, compatible elements." });
      return false;
    }
    const normalized = normalizeConnection(source, target);
    if (!normalized) {
      set({
        message: "These elements cannot be connected in Chen/EER notation.",
      });
      return false;
    }
    const reverse = normalized.source !== sourceId;
    const edge = makeEdge(
      newId(),
      normalized.source,
      normalized.target,
      normalized.kind,
    );
    if (
      normalized.kind === "participation" &&
      ((source.data.weak && target.data.identifying) ||
        (target.data.weak && source.data.identifying))
    )
      edge.data.participation = "total";
    edge.sourceHandle = reverse
      ? (targetHandle ?? undefined)
      : (sourceHandle ?? undefined);
    edge.targetHandle = reverse
      ? (sourceHandle ?? undefined)
      : (targetHandle ?? undefined);
    set((state) =>
      mark(state, {
        edges: [...state.edges, edge],
        nodes:
          normalized.kind === "attribute" &&
          target.data.kind === "attribute" &&
          source.data.kind === "attribute"
            ? state.nodes.map((n) =>
                n.id === normalized.target
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        attribute: { ...n.data.attribute, isComposite: true },
                      },
                    }
                  : n,
              )
            : state.nodes,
      }),
    );
    return true;
  },
  addEdge: (edge) => set((s) => mark(s, { edges: [...s.edges, edge] })),
  reconnect: (id, source, target, sourceHandle, targetHandle) => {
    const s = get(),
      edge = s.edges.find((e) => e.id === id),
      a = s.nodes.find((n) => n.id === source),
      b = s.nodes.find((n) => n.id === target);
    if (!edge || !a || !b || source === target) return false;
    const normalized = normalizeConnection(a, b);
    if (!normalized || normalized.kind !== edge.data.kind) {
      set({ message: "This connector requires compatible endpoint types." });
      return false;
    }
    const reverse = normalized.source !== source;
    set((state) =>
      mark(state, {
        edges: state.edges.map((e) =>
          e.id === id
            ? {
                ...e,
                source: normalized.source,
                target: normalized.target,
                sourceHandle:
                  (reverse ? targetHandle : sourceHandle) ?? undefined,
                targetHandle:
                  (reverse ? sourceHandle : targetHandle) ?? undefined,
              }
            : e,
        ),
      }),
    );
    return true;
  },
  updateNode: (id, patch) =>
    set((s) => {
      const next = {
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      };
      return s.gesture ? { ...next, status: "saving" } : mark(s, next);
    }),
  updateEdge: (id, patch) =>
    set((s) => {
      const next = {
        edges: s.edges.map((e) =>
          e.id === id ? { ...e, data: { ...e.data, ...patch } } : e,
        ),
      };
      return s.gesture ? { ...next, status: "saving" } : mark(s, next);
    }),
  applyNodes: (changes) =>
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes),
      status: changes.some(
        (c) =>
          c.type === "position" ||
          c.type === "dimensions" ||
          c.type === "remove",
      )
        ? "saving"
        : s.status,
    })),
  applyEdges: (changes) =>
    set((s) => {
      const next = applyEdgeChanges(changes, s.edges);
      return changes.some((c) => c.type === "remove")
        ? mark(s, { edges: next })
        : { edges: next };
    }),
  beginGesture: () => set((s) => ({ gesture: snapshot(s) })),
  endGesture: () =>
    set((s) => {
      if (!s.gesture) return {};
      const changed = JSON.stringify(snapshot(s)) !== JSON.stringify(s.gesture);
      return changed
        ? {
            past: [...s.past.slice(-99), s.gesture],
            future: [],
            gesture: null,
            status: "saving",
          }
        : { gesture: null };
    }),
  removeSelected: () =>
    set((s) => {
      const ids = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id));
      const edgeIds = new Set(
        s.edges.filter((e) => e.selected).map((e) => e.id),
      );
      if (!ids.size && !edgeIds.size) return {};
      return mark(s, {
        nodes: s.nodes.filter((n) => !ids.has(n.id)),
        edges: s.edges.filter(
          (e) => !edgeIds.has(e.id) && !ids.has(e.source) && !ids.has(e.target),
        ),
      });
    }),
  selectAll: () =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: true })),
      edges: s.edges.map((e) => ({ ...e, selected: true })),
    })),
  clearSelection: () =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: false })),
      edges: s.edges.map((e) => ({ ...e, selected: false })),
    })),
  selectNode: (id) =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: n.id === id })),
      edges: s.edges.map((e) => ({ ...e, selected: false })),
    })),
  selectEdge: (id) =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: false })),
      edges: s.edges.map((e) => ({ ...e, selected: e.id === id })),
    })),
  copy: () =>
    set((s) => {
      const nodes = selectedNodes(s);
      const ids = new Set(nodes.map((n) => n.id));
      return {
        clipboard: {
          nodes: structuredClone(nodes),
          edges: structuredClone(
            s.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
          ),
        },
        pasteCount: 0,
        message: nodes.length
          ? `Copied ${nodes.length} element${nodes.length === 1 ? "" : "s"}.`
          : "Select elements to copy.",
      };
    }),
  paste: (x, y) =>
    set((s) => {
      if (!s.clipboard?.nodes.length) return { message: "Nothing to paste." };
      const ids = new Map(s.clipboard.nodes.map((n) => [n.id, newId()]));
      const minX = Math.min(...s.clipboard.nodes.map((n) => n.position.x)),
        minY = Math.min(...s.clipboard.nodes.map((n) => n.position.y));
      const offset = 32 * (s.pasteCount + 1);
      const nodes = s.clipboard.nodes.map((n) => ({
        ...structuredClone(n),
        id: ids.get(n.id)!,
        position: {
          x: x === undefined ? n.position.x + offset : x + n.position.x - minX,
          y: y === undefined ? n.position.y + offset : y + n.position.y - minY,
        },
        selected: true,
      }));
      const edges = s.clipboard.edges.map((e) => ({
        ...structuredClone(e),
        id: newId(),
        source: ids.get(e.source)!,
        target: ids.get(e.target)!,
        selected: false,
      }));
      return mark(s, {
        nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...nodes],
        edges: [...s.edges.map((e) => ({ ...e, selected: false })), ...edges],
        pasteCount: s.pasteCount + 1,
      });
    }),
  duplicate: () => {
    if (!selectedNodes(get()).length) {
      set({ message: "Select an element to duplicate." });
      return;
    }
    get().copy();
    get().paste();
  },
  insertTemplate: (document, x, y) => {
    get().endGesture();
    set((s) => {
      if (!document.nodes.length) return {};
      const ids = new Map(document.nodes.map((n) => [n.id, newId()]));
      const minX = Math.min(...document.nodes.map((n) => n.position.x)),
        minY = Math.min(...document.nodes.map((n) => n.position.y));
      const nodes = document.nodes.map((n) => ({
        ...structuredClone(n),
        id: ids.get(n.id)!,
        position: { x: x + n.position.x - minX, y: y + n.position.y - minY },
        selected: true,
      }));
      const edges = document.edges.map((e) => ({
        ...structuredClone(e),
        id: newId(),
        source: ids.get(e.source)!,
        target: ids.get(e.target)!,
        selected: false,
      }));
      return mark(s, {
        title: s.nodes.length ? s.title : document.title,
        nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...nodes],
        edges: [...s.edges.map((e) => ({ ...e, selected: false })), ...edges],
        activeTool: null,
        toolPatch: {},
        editingId: null,
        message: `Inserted ${document.title}. Ctrl/Cmd+Z to undo.`,
      });
    });
  },
  arrange: () => {
    get().endGesture();
    set((s) => {
      const selection = selectedNodes(s);
      const chosen = selection.length > 1 ? selection : s.nodes;
      if (!chosen.length) return {};
      const ids = new Set(chosen.map((n) => n.id));
      const arranged = layoutNodes(
        chosen,
        s.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
      );
      const offset =
        selection.length > 1
          ? {
              x:
                Math.min(...chosen.map((n) => n.position.x)) -
                Math.min(...arranged.map((n) => n.position.x)),
              y:
                Math.min(...chosen.map((n) => n.position.y)) -
                Math.min(...arranged.map((n) => n.position.y)),
            }
          : { x: 0, y: 0 };
      const positions = new Map(
        arranged.map((n) => [
          n.id,
          { x: n.position.x + offset.x, y: n.position.y + offset.y },
        ]),
      );
      return mark(s, {
        nodes: s.nodes.map((n) =>
          positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n,
        ),
        message: `${selection.length > 1 ? "Selection" : "Diagram"} arranged. Ctrl/Cmd+Z to undo.`,
      });
    });
  },
  nudge: (x, y) =>
    set((s) => {
      if (!selectedNodes(s).length) return {};
      const next = {
        nodes: s.nodes.map((n) =>
          n.selected
            ? { ...n, position: { x: n.position.x + x, y: n.position.y + y } }
            : n,
        ),
      };
      return s.gesture ? { ...next, status: "saving" } : mark(s, next);
    }),
  addRelatedNode: (ownerId, kind, patch = {}) => {
    const s = get(),
      owner = s.nodes.find((n) => n.id === ownerId);
    if (!owner) return null;
    const id = newId(),
      size = nodeSize(owner);
    const count = s.edges.filter(
      (e) => e.source === ownerId || e.target === ownerId,
    ).length;
    const node = makeNode(
      id,
      kind,
      owner.position.x + ((count % 3) - 1) * 180,
      owner.position.y +
        (kind === "attribute"
          ? -150 - Math.floor(count / 3) * 100
          : size.height + 130 + Math.floor(count / 3) * 80),
      patch,
    );
    const connection =
      kind === "attribute"
        ? normalizeConnection(node, owner)
        : normalizeConnection(owner, node);
    if (!connection) return null;
    get().endGesture();
    set((state) =>
      mark(state, {
        nodes: [
          ...state.nodes.map((n) => ({
            ...n,
            selected: false,
            data:
              n.id === ownerId && owner.data.kind === "attribute"
                ? {
                    ...n.data,
                    attribute: { ...n.data.attribute, isComposite: true },
                  }
                : n.data,
          })),
          { ...node, selected: true },
        ],
        edges: [
          ...state.edges.map((e) => ({ ...e, selected: false })),
          makeEdge(
            newId(),
            connection.source,
            connection.target,
            connection.kind,
          ),
        ],
        activeTool: null,
        toolPatch: {},
        editingId: null,
      }),
    );
    return id;
  },
  align: (mode) =>
    set((s) => {
      const chosen = selectedNodes(s);
      if (chosen.length < 2)
        return { message: "Select at least two elements to align." };
      const dimensions = new Map(chosen.map((n) => [n.id, nodeSize(n)]));
      const minX = Math.min(...chosen.map((n) => n.position.x)),
        maxX = Math.max(
          ...chosen.map((n) => n.position.x + dimensions.get(n.id)!.width),
        ),
        minY = Math.min(...chosen.map((n) => n.position.y)),
        maxY = Math.max(
          ...chosen.map((n) => n.position.y + dimensions.get(n.id)!.height),
        );
      const ordered = [...chosen].sort((a, b) =>
        mode === "distribute-h"
          ? a.position.x - b.position.x
          : a.position.y - b.position.y,
      );
      const positions = new Map<string, { x: number; y: number }>();
      chosen.forEach((n) => positions.set(n.id, { ...n.position }));
      chosen.forEach((n) => {
        const p = positions.get(n.id)!;
        const size = dimensions.get(n.id)!;
        if (mode === "left") p.x = minX;
        if (mode === "center") p.x = (minX + maxX - size.width) / 2;
        if (mode === "right") p.x = maxX - size.width;
        if (mode === "top") p.y = minY;
        if (mode === "middle") p.y = (minY + maxY - size.height) / 2;
        if (mode === "bottom") p.y = maxY - size.height;
      });
      if (mode === "distribute-h" && ordered.length > 2) {
        const gap =
          (maxX -
            minX -
            chosen.reduce((sum, n) => sum + dimensions.get(n.id)!.width, 0)) /
          (ordered.length - 1);
        let cursor = minX;
        ordered.forEach((n) => {
          positions.get(n.id)!.x = cursor;
          cursor += dimensions.get(n.id)!.width + gap;
        });
      }
      if (mode === "distribute-v" && ordered.length > 2) {
        const gap =
          (maxY -
            minY -
            chosen.reduce((sum, n) => sum + dimensions.get(n.id)!.height, 0)) /
          (ordered.length - 1);
        let cursor = minY;
        ordered.forEach((n) => {
          positions.get(n.id)!.y = cursor;
          cursor += dimensions.get(n.id)!.height + gap;
        });
      }
      return mark(s, {
        nodes: s.nodes.map((n) =>
          positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n,
        ),
      });
    }),
  reorder: (id, direction) =>
    set((s) => {
      const zs = s.nodes.map((n) => n.zIndex ?? 0);
      const z =
        direction === "front" ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
      return mark(s, {
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, zIndex: z } : n)),
      });
    }),
  undo: () =>
    set((s) => {
      const previous = s.past[s.past.length - 1];
      return previous
        ? {
            ...previous,
            past: s.past.slice(0, -1),
            future: [snapshot(s), ...s.future],
            gesture: null,
            editingId: null,
            activeTool: null,
            toolPatch: {},
            status: "saving",
          }
        : {};
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      return next
        ? {
            ...next,
            past: [...s.past, snapshot(s)],
            future: s.future.slice(1),
            gesture: null,
            editingId: null,
            activeTool: null,
            toolPatch: {},
            status: "saving",
          }
        : {};
    }),
  replaceDocument: (document) => {
    get().endGesture();
    set((s) =>
      mark(s, {
        ...cleanDocument(document),
        gesture: null,
        activeTool: null,
        toolPatch: {},
        editingId: null,
        status: "saving",
      }),
    );
  },
  newDocument: () => {
    get().endGesture();
    set((s) =>
      mark(s, {
        version: 1,
        title: "Untitled diagram",
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        settings: { grid: true, snap: false },
        gesture: null,
        status: "saving",
        activeTool: null,
        toolPatch: {},
        editingId: null,
      }),
    );
  },
  saveNow: () => {
    try {
      const s = get();
      localStorage.setItem(STORAGE, JSON.stringify(cleanDocument(s)));
      set({ status: "saved" });
    } catch {
      set({
        status: "error",
        message: "Could not save locally. Check browser storage settings.",
      });
    }
  },
}));

export { STORAGE };
export const shouldFitInitialView = !loadedFromStorage;
