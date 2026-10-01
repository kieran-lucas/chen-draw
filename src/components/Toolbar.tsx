import { useReactFlow } from "@xyflow/react";
import {
  Download,
  FileJson,
  Focus,
  Grid2X2,
  Magnet,
  Maximize2,
  Plus,
  Redo2,
  Save,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { cleanDocument, parseDocument } from "../model/serialization";
import { useEditor } from "../store/editorStore";
import { exportPng, exportSvg } from "../utils/export";

function IconButton({
  label,
  children,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className={pressed ? "toggled" : ""}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function downloadJson() {
  const diagram = cleanDocument(useEditor.getState());
  const blob = new Blob([JSON.stringify(diagram, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    diagram.title
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .toLowerCase() || "chen-diagram"
  }.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function Toolbar() {
  const rf = useReactFlow();
  const title = useEditor((s) => s.title),
    status = useEditor((s) => s.status),
    settings = useEditor((s) => s.settings);
  const canUndo = useEditor((s) => s.past.length > 0),
    canRedo = useEditor((s) => s.future.length > 0);
  const [draft, setDraft] = useState(title);
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cancelledTitle = useRef(false);
  useEffect(() => setDraft(title), [title]);
  const actions = useEditor.getState();
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const doc = parseDocument(JSON.parse(await file.text()) as unknown);
      useEditor.getState().replaceDocument(doc);
      rf.setViewport(doc.viewport);
      useEditor.getState().setMessage("Diagram imported.");
    } catch (error) {
      useEditor
        .getState()
        .setMessage(
          error instanceof Error
            ? error.message
            : "Could not import this JSON file.",
        );
    }
  };
  const imageExport = async (format: "png" | "svg") => {
    if (exporting) return;
    setExporting(true);
    try {
      const doc = cleanDocument(useEditor.getState());
      if (format === "png") await exportPng(doc);
      else await exportSvg(doc);
      useEditor.getState().setMessage(`${format.toUpperCase()} exported.`);
    } catch (error) {
      useEditor
        .getState()
        .setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };
  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved locally"
        : "Save failed";
  return (
    <header className="toolbar">
      <div className="brand">
        <img
          className="brand-mark"
          src="./chen-studio.svg"
          alt=""
          aria-hidden="true"
        />
        <span>Chen Studio</span>
        <span className="brand-edition">ER / EER</span>
      </div>
      <div className="toolbar-separator" />
      <input
        className="diagram-title"
        aria-label="Diagram name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelledTitle.current) {
            cancelledTitle.current = false;
            return;
          }
          if (draft.trim() !== title)
            actions.setTitle(draft.trim() || "Untitled diagram");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelledTitle.current = true;
            setDraft(title);
            e.currentTarget.blur();
          }
        }}
      />
      <span className={`save-status ${status}`} title={statusText}>
        <span className="status-dot" />
        {statusText}
      </span>
      <div className="toolbar-spacer" />
      <div className="toolbar-group">
        <IconButton label="Undo" disabled={!canUndo} onClick={actions.undo}>
          <Undo2 size={17} />
        </IconButton>
        <IconButton label="Redo" disabled={!canRedo} onClick={actions.redo}>
          <Redo2 size={17} />
        </IconButton>
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <IconButton
          label="New diagram"
          onClick={() => {
            actions.newDocument();
            rf.setViewport({ x: 0, y: 0, zoom: 1 });
          }}
        >
          <Plus size={17} />
        </IconButton>
        <IconButton label="Save locally" onClick={actions.saveNow}>
          <Save size={17} />
        </IconButton>
        <IconButton
          label="Import JSON"
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={17} />
        </IconButton>
        <IconButton label="Export JSON" onClick={downloadJson}>
          <FileJson size={17} />
        </IconButton>
        <IconButton
          label="Export PNG"
          disabled={exporting}
          onClick={() => void imageExport("png")}
        >
          <Download size={17} />
          <span>PNG</span>
        </IconButton>
        <IconButton
          label="Export SVG"
          disabled={exporting}
          onClick={() => void imageExport("svg")}
        >
          <Download size={17} />
          <span>SVG</span>
        </IconButton>
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <IconButton
          label="Zoom out"
          onClick={() => rf.zoomOut({ duration: 180 })}
        >
          <ZoomOut size={17} />
        </IconButton>
        <IconButton
          label="Zoom in"
          onClick={() => rf.zoomIn({ duration: 180 })}
        >
          <ZoomIn size={17} />
        </IconButton>
        <IconButton
          label="Fit view"
          onClick={() => rf.fitView({ padding: 0.16, duration: 300 })}
        >
          <Maximize2 size={16} />
        </IconButton>
        <IconButton
          label="Reset zoom"
          onClick={() => rf.zoomTo(1, { duration: 180 })}
        >
          <Focus size={17} />
        </IconButton>
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <IconButton
          label="Toggle dot grid"
          pressed={settings.grid}
          onClick={() => actions.setSettings({ grid: !settings.grid })}
        >
          <Grid2X2 size={17} />
        </IconButton>
        <IconButton
          label="Toggle snap to grid"
          pressed={settings.snap}
          onClick={() => actions.setSettings({ snap: !settings.snap })}
        >
          <Magnet size={17} />
        </IconButton>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={importFile}
      />
    </header>
  );
}
