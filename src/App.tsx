import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type OnReconnect,
} from "@xyflow/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { StudioEdge } from "./components/canvas/StudioEdge";
import { StudioNode } from "./components/canvas/StudioNode";
import { Inspector } from "./components/Inspector";
import { Palette } from "./components/Palette";
import { Toolbar } from "./components/Toolbar";
import { WorkspaceBar } from "./components/WorkspaceBar";
import { StudioDialog } from "./components/StudioDialog";
import { nodeSize } from "./geometry/diagram";
import {
  makeNode,
  type NodeKind,
  type StudioNode as StudioNodeType,
  type StudioEdge as StudioEdgeType,
  type StudioNodeData,
  type StudioDocument,
} from "./model/types";
import { shouldFitInitialView, useEditor } from "./store/editorStore";

const nodeTypes = { studio: StudioNode },
  edgeTypes = { chen: StudioEdge };
const kinds: NodeKind[] = [
  "entity",
  "relationship",
  "attribute",
  "specialization",
  "category",
  "annotation",
];
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
type Menu = {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  nodeId?: string;
  edgeId?: string;
};

function Editor() {
  const rf = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const initialViewFitted = useRef(false);
  const nodes = useEditor((s) => s.nodes),
    edges = useEditor((s) => s.edges),
    viewport = useEditor((s) => s.viewport),
    settings = useEditor((s) => s.settings);
  const message = useEditor((s) => s.message);
  const tool = useEditor((s) => s.activeTool),
    toolPatch = useEditor((s) => s.toolPatch);
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 900),
    [rightOpen, setRightOpen] = useState(() => window.innerWidth > 900),
    [menu, setMenu] = useState<Menu | null>(null),
    [isaSource, setIsaSource] = useState<string | null>(null),
    [dialog, setDialog] = useState<"templates" | "guide" | null>(null),
    [minimap, setMinimap] = useState(false);
  const actions = useEditor.getState();
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 900px)");
    const onChange = () => {
      if (narrow.matches) {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    narrow.addEventListener("change", onChange);
    return () => narrow.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    if (
      shouldFitInitialView &&
      nodesInitialized &&
      !initialViewFitted.current
    ) {
      initialViewFitted.current = true;
      void rf.fitView({ padding: 0.16, duration: 0 });
    }
  }, [nodesInitialized, rf]);
  useEffect(() => {
    const current = rf.getViewport();
    if (
      Math.abs(current.x - viewport.x) > 0.1 ||
      Math.abs(current.y - viewport.y) > 0.1 ||
      Math.abs(current.zoom - viewport.zoom) > 0.001
    )
      void rf.setViewport(viewport);
  }, [viewport, rf]);
  useEffect(() => {
    if (tool !== "isa") setIsaSource(null);
  }, [tool]);
  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout>;
    const unsubscribe = useEditor.subscribe((state) => {
      if (state.status === "saving") {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => useEditor.getState().saveNow(), 600);
      }
    });
    const flush = () => {
      if (useEditor.getState().status === "saving")
        useEditor.getState().saveNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      clearTimeout(saveTimer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => useEditor.getState().setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  const addAt = useCallback(
    (
      kind: NodeKind,
      x: number,
      y: number,
      patch: Partial<StudioNodeData> = {},
    ) => {
      const draft = makeNode("preview", kind, 0, 0, patch),
        size = nodeSize(draft);
      const id = useEditor
        .getState()
        .addNode(kind, x - size.width / 2, y - size.height / 2, patch);
      useEditor.getState().setTool(null);
      if (kind !== "specialization" && kind !== "category")
        requestAnimationFrame(() => useEditor.getState().setEditing(id));
    },
    [],
  );
  const placeAtClient = (
    kind: NodeKind,
    clientX: number,
    clientY: number,
    patch: Partial<StudioNodeData> = {},
  ) => {
    const p = rf.screenToFlowPosition({ x: clientX, y: clientY });
    addAt(kind, p.x, p.y, patch);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/chen-node");
    if (!raw) return;
    try {
      const item = JSON.parse(raw) as {
        kind?: NodeKind;
        patch?: Partial<StudioNodeData> | "weak" | "identifying";
      };
      if (!item.kind || !kinds.includes(item.kind)) throw new Error();
      placeAtClient(
        item.kind,
        e.clientX,
        e.clientY,
        typeof item.patch === "string"
          ? { [item.patch]: true }
          : (item.patch ?? {}),
      );
    } catch {
      useEditor.getState().setMessage("This palette item could not be placed.");
    }
  };
  const onConnect = useCallback((connection: Connection) => {
    useEditor
      .getState()
      .connect(
        connection.source,
        connection.target,
        connection.sourceHandle,
        connection.targetHandle,
      );
  }, []);
  const onReconnect: OnReconnect<StudioEdgeType> = useCallback(
    (edge, connection) => {
      useEditor
        .getState()
        .reconnect(
          edge.id,
          connection.source,
          connection.target,
          connection.sourceHandle,
          connection.targetHandle,
        );
    },
    [],
  );
  const fit = () => rf.fitView({ padding: 0.16, duration: 300 });
  const fitSelection = () => {
    const selected = useEditor.getState().nodes.filter((n) => n.selected);
    return selected.length
      ? rf.fitView({ nodes: selected, padding: 0.3, duration: 250 })
      : fit();
  };
  const arrange = () => {
    useEditor.getState().arrange();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => void fitSelection()),
    );
  };
  const insertTemplate = (doc: StudioDocument) => {
    const current = useEditor.getState().nodes;
    const x = current.length
      ? Math.max(...current.map((n) => n.position.x + nodeSize(n).width)) + 180
      : 100;
    useEditor.getState().insertTemplate(doc, x, 100);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => void fitSelection()),
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || e.altKey) return;
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey,
        key = e.key.toLowerCase(),
        state = useEditor.getState();
      if (mod && key === "z") {
        e.preventDefault();
        e.shiftKey ? state.redo() : state.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        state.redo();
      } else if (mod && key === "c") {
        e.preventDefault();
        state.copy();
      } else if (mod && key === "v") {
        e.preventDefault();
        state.paste();
      } else if (mod && key === "d") {
        e.preventDefault();
        state.duplicate();
      } else if (mod && key === "a") {
        e.preventDefault();
        state.selectAll();
      } else if (mod && key === "s") {
        e.preventDefault();
        state.saveNow();
        state.setMessage("Diagram saved locally.");
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        state.removeSelected();
      } else if (e.key === "Escape") {
        state.setTool(null);
        state.clearSelection();
        setMenu(null);
        setIsaSource(null);
      } else if (!mod && key === "f") {
        e.preventDefault();
        void (e.shiftKey ? fitSelection() : fit());
      } else if (!mod && e.key === "F2") {
        const selected = state.nodes.filter((n) => n.selected);
        if (
          selected.length === 1 &&
          !["specialization", "category"].includes(selected[0].data.kind)
        ) {
          e.preventDefault();
          state.setEditing(selected[0].id);
        }
      } else if (
        !mod &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        if (!state.nodes.some((n) => n.selected)) return;
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) state.beginGesture();
        const step = e.shiftKey ? 20 : state.settings.snap ? 20 : 1;
        state.nudge(
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
        );
      } else if (!mod && e.key === "?") {
        e.preventDefault();
        setDialog("guide");
      } else if (!mod && !e.shiftKey) {
        const hotkeys: Record<string, NodeKind> = {
          e: "entity",
          r: "relationship",
          a: "attribute",
          s: "specialization",
          t: "annotation",
        };
        if (hotkeys[key]) {
          e.preventDefault();
          state.setTool(hotkeys[key]);
        }
      }
    };
    const finishNudge = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow") && !isTyping(e.target))
        useEditor.getState().endGesture();
    };
    const finishGesture = () => useEditor.getState().endGesture();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", finishNudge);
    window.addEventListener("blur", finishGesture);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", finishNudge);
      window.removeEventListener("blur", finishGesture);
    };
  }, [rf, dialog]);
  const menuAction = (action: string) => {
    if (!menu) return;
    const state = useEditor.getState();
    if (menu.nodeId) {
      state.selectNode(menu.nodeId);
      if (action === "rename") state.setEditing(menu.nodeId);
      if (action === "duplicate") state.duplicate();
      if (action === "delete") state.removeSelected();
      if (action === "front") state.reorder(menu.nodeId, "front");
      if (action === "back") state.reorder(menu.nodeId, "back");
    } else if (menu.edgeId) {
      state.selectEdge(menu.edgeId);
      if (action === "delete") state.removeSelected();
    } else {
      if (action === "entity") addAt("entity", menu.flowX, menu.flowY);
      if (action === "relationship")
        addAt("relationship", menu.flowX, menu.flowY);
      if (action === "attribute") addAt("attribute", menu.flowX, menu.flowY);
      if (action === "specialization")
        addAt("specialization", menu.flowX, menu.flowY);
      if (action === "category") addAt("category", menu.flowX, menu.flowY);
      if (action === "paste") state.paste(menu.flowX, menu.flowY);
      if (action === "fit") fit();
    }
    setMenu(null);
  };
  const openMenu = (
    e: { preventDefault(): void; clientX: number; clientY: number },
    extra: Partial<Menu> = {},
  ) => {
    e.preventDefault();
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setMenu({ x: e.clientX, y: e.clientY, flowX: p.x, flowY: p.y, ...extra });
  };
  return (
    <div className="app-shell" onClick={() => menu && setMenu(null)}>
      <Toolbar />
      <WorkspaceBar
        onTemplates={() => setDialog("templates")}
        onGuide={() => setDialog("guide")}
        onArrange={arrange}
        minimap={minimap}
        onMinimap={() => setMinimap(!minimap)}
      />
      <div
        className={`workspace ${leftOpen ? "palette-open" : ""} ${rightOpen ? "inspector-open" : ""}`}
      >
        {leftOpen && <Palette />}
        <button
          className="collapse-button collapse-left"
          onClick={() => setLeftOpen(!leftOpen)}
          title={leftOpen ? "Collapse elements" : "Expand elements"}
          aria-label={leftOpen ? "Collapse elements" : "Expand elements"}
        >
          {leftOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
        <main
          className={`canvas-wrap ${tool ? "placing" : ""}`}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
        >
          <ReactFlow<StudioNodeType, StudioEdgeType>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={viewport}
            minZoom={0.15}
            maxZoom={3}
            fitView={false}
            nodesConnectable
            connectionMode={ConnectionMode.Loose}
            onNodesChange={actions.applyNodes}
            onEdgesChange={actions.applyEdges}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeDragStart={actions.beginGesture}
            onNodeDragStop={actions.endGesture}
            onSelectionDragStart={actions.beginGesture}
            onSelectionDragStop={actions.endGesture}
            onMoveEnd={(_, vp) => useEditor.getState().setViewport(vp)}
            onPaneClick={(e) => {
              if (tool && tool !== "isa")
                placeAtClient(tool, e.clientX, e.clientY, toolPatch);
            }}
            onNodeClick={(_, n) => {
              if (tool !== "isa") return;
              if (n.data.kind !== "entity") {
                useEditor
                  .getState()
                  .setMessage("Direct IS-A connects two entities.");
                return;
              }
              if (!isaSource) {
                setIsaSource(n.id);
                useEditor
                  .getState()
                  .setMessage("Now click the subclass entity.");
              } else {
                if (useEditor.getState().connect(isaSource, n.id)) {
                  setIsaSource(null);
                  useEditor.getState().setTool(null);
                }
              }
            }}
            onPaneContextMenu={(e) => openMenu(e)}
            onNodeContextMenu={(e, n) => openMenu(e, { nodeId: n.id })}
            onEdgeContextMenu={(e, edge) => openMenu(e, { edgeId: edge.id })}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Shift"
            panOnDrag={[0, 1, 2]}
            snapToGrid={settings.snap}
            snapGrid={[20, 20]}
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            defaultEdgeOptions={{ type: "chen", reconnectable: true }}
            connectionLineStyle={{ stroke: "#367bd2", strokeWidth: 1.8 }}
          >
            {minimap && nodes.length > 0 && (
              <MiniMap
                pannable
                zoomable
                position="top-right"
                nodeColor={(n) =>
                  n.data.kind === "entity"
                    ? "#789cb9"
                    : n.data.kind === "relationship"
                      ? "#9fbab2"
                      : "#c6d2dd"
                }
                maskColor="rgba(235, 241, 247, 0.75)"
              />
            )}
            {settings.grid && (
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1.3}
                color="#d9dfe6"
              />
            )}
          </ReactFlow>
          {!nodes.length && !tool && (
            <div className="canvas-empty">
              <span className="empty-canvas-symbol">◇</span>
              <h2>Your next model starts here</h2>
              <p>
                Add entities, relationships and attributes.
                <br />
                Build with classical Chen and EER notation.
              </p>
              <button onClick={() => setDialog("templates")}>
                Browse templates
              </button>
              <small>Press E to add an entity · ? for the notation guide</small>
            </div>
          )}
          <div className="canvas-tip">
            {tool === "isa"
              ? isaSource
                ? "Click the subclass entity. Press Esc to cancel."
                : "Click the superclass entity, then the subclass. Press Esc to cancel."
              : tool
                ? `Click to place ${tool}. Press Esc to cancel.`
                : "Drag blank canvas to pan · Shift+drag to select · Right-click for actions"}
          </div>
          <div className="canvas-zoom">{Math.round(viewport.zoom * 100)}%</div>
        </main>
        <button
          className="collapse-button collapse-right"
          onClick={() => setRightOpen(!rightOpen)}
          title={rightOpen ? "Collapse properties" : "Expand properties"}
          aria-label={rightOpen ? "Collapse properties" : "Expand properties"}
        >
          {rightOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
        {rightOpen && <Inspector />}
      </div>
      {dialog && (
        <StudioDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onInsert={insertTemplate}
        />
      )}
      {menu && (
        <div
          className="context-menu"
          style={{
            left: Math.max(8, Math.min(menu.x, window.innerWidth - 200)),
            top: Math.max(8, Math.min(menu.y, window.innerHeight - 310)),
          }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          {(menu.nodeId
            ? [
                ...(nodes.find((n) => n.id === menu.nodeId)?.data.kind ===
                  "specialization" ||
                nodes.find((n) => n.id === menu.nodeId)?.data.kind ===
                  "category"
                  ? []
                  : [["rename", "Rename"]]),
                ["duplicate", "Duplicate"],
                ["delete", "Delete"],
                ["front", "Bring to front"],
                ["back", "Send to back"],
              ]
            : menu.edgeId
              ? [["delete", "Delete connector"]]
              : [
                  ["entity", "Add entity"],
                  ["relationship", "Add relationship"],
                  ["attribute", "Add attribute"],
                  ["specialization", "Add specialization"],
                  ["category", "Add category"],
                  ["paste", "Paste"],
                  ["fit", "Fit view"],
                ]
          ).map(([action, label]) => (
            <button
              key={action}
              role="menuitem"
              onClick={() => menuAction(action)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button
            onClick={() => actions.setMessage(null)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
