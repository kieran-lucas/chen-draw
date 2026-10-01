import {
  BookOpen,
  LayoutTemplate,
  Map,
  Wand2,
  MousePointer2,
} from "lucide-react";
import { useEditor } from "../store/editorStore";

export function WorkspaceBar({
  onTemplates,
  onGuide,
  onArrange,
  minimap,
  onMinimap,
}: {
  onTemplates: () => void;
  onGuide: () => void;
  onArrange: () => void;
  minimap: boolean;
  onMinimap: () => void;
}) {
  const nodes = useEditor((s) => s.nodes),
    edges = useEditor((s) => s.edges),
    tool = useEditor((s) => s.activeTool);
  const count =
    nodes.filter((n) => n.selected).length +
    edges.filter((e) => e.selected).length;
  return (
    <nav className="workspace-bar" aria-label="Model tools">
      <button
        aria-label="Select tool"
        aria-pressed={!tool}
        className={!tool ? "active" : ""}
        onClick={() => useEditor.getState().setTool(null)}
        title="Select and move elements (Esc)"
      >
        <MousePointer2 size={15} />
        <span>Select</span>
      </button>
      <div className="toolbar-separator" />
      <button onClick={onTemplates}>
        <LayoutTemplate size={15} />
        <span>Templates</span>
      </button>
      <button
        onClick={onArrange}
        disabled={!nodes.length}
        title="Arrange selection or whole diagram. Undo with Ctrl/Cmd+Z."
      >
        <Wand2 size={15} />
        <span>Tidy layout</span>
      </button>
      <button onClick={onGuide}>
        <BookOpen size={15} />
        <span>Notation guide</span>
      </button>
      <span className="workspace-summary">
        {nodes.length} elements · {edges.length} connectors
        {count ? ` · ${count} selected` : ""}
      </span>
      <button
        aria-label="Toggle minimap"
        aria-pressed={minimap}
        className={minimap ? "active" : ""}
        onClick={onMinimap}
      >
        <Map size={15} />
        <span>Minimap</span>
      </button>
      <span className="notation-badge">CLASSICAL CHEN</span>
    </nav>
  );
}
