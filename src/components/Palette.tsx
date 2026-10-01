import { Minus, Search } from "lucide-react";
import { useState } from "react";
import { nodeSize, shapeMarkup } from "../geometry/diagram";
import {
  DEFAULT_ATTRIBUTE,
  makeNode,
  type NodeKind,
  type StudioNodeData,
} from "../model/types";
import { specializationPresets } from "../model/presets";
import { useEditor } from "../store/editorStore";
import { Outline } from "./Outline";

type PaletteItem = {
  kind: NodeKind | "isa";
  title: string;
  description: string;
  group: string;
  patch?: Partial<StudioNodeData>;
  shortcut?: string;
};
const items: PaletteItem[] = [
  {
    kind: "entity",
    title: "Entity",
    description: "Single rectangle",
    group: "ER elements",
    shortcut: "E",
  },
  {
    kind: "entity",
    title: "Weak entity",
    description: "Double rectangle",
    group: "ER elements",
    patch: { weak: true },
  },
  {
    kind: "relationship",
    title: "Relationship",
    description: "Diamond",
    group: "ER elements",
    shortcut: "R",
  },
  {
    kind: "relationship",
    title: "Identifying relationship",
    description: "Double diamond",
    group: "ER elements",
    patch: { identifying: true },
  },
  {
    kind: "attribute",
    title: "Attribute",
    description: "Simple oval",
    group: "Attributes",
    shortcut: "A",
  },
  ...(
    [
      ["Key attribute", "Solid underline", "isKey"],
      ["Partial key", "Dashed underline", "isPartialKey"],
      ["Multivalued attribute", "Double oval", "isMultivalued"],
      ["Derived attribute", "Dashed oval", "isDerived"],
      ["Composite attribute", "Connect component ovals", "isComposite"],
    ] as const
  ).map(([title, description, property]) => ({
    kind: "attribute" as const,
    title,
    description,
    group: "Attributes",
    patch: { attribute: { ...DEFAULT_ATTRIBUTE, [property]: true } },
  })),
  {
    kind: "isa",
    title: "Direct subclass / IS-A",
    description: "Click superclass, then subclass",
    group: "EER elements",
  },
  {
    kind: "specialization",
    title: "Specialization",
    description: "d or o circle",
    group: "EER elements",
    shortcut: "S",
  },
  {
    kind: "category",
    title: "Category / Union",
    description: "U circle",
    group: "EER elements",
  },
  {
    kind: "annotation",
    title: "Text annotation",
    description: "Free text",
    group: "Annotations",
    shortcut: "T",
  },
];
function ShapeIcon({ item }: { item: PaletteItem }) {
  if (item.kind === "isa") return <Minus size={23} />;
  const node = makeNode("preview", item.kind, 0, 0, {
    name:
      item.kind === "annotation"
        ? "T"
        : item.patch?.attribute?.isKey || item.patch?.attribute?.isPartialKey
          ? "id"
          : "",
    ...item.patch,
  });
  const size = nodeSize(node);
  return (
    <svg
      width="30"
      height="24"
      viewBox={`-3 -3 ${size.width + 6} ${size.height + 6}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: shapeMarkup(node) }}
    />
  );
}
export function Palette() {
  const tool = useEditor((s) => s.activeTool),
    toolPatch = useEditor((s) => s.toolPatch),
    setTool = useEditor((s) => s.setTool);
  const [tab, setTab] = useState<"tools" | "model">("tools"),
    [query, setQuery] = useState("");
  const active = (item: PaletteItem) =>
    tool === item.kind &&
    JSON.stringify(toolPatch) === JSON.stringify(item.patch ?? {});
  const filtered = items.filter((item) =>
    `${item.title} ${item.description}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <aside className="sidebar palette" aria-label="Element palette">
      <div className="sidebar-heading">
        <span className="sidebar-eyebrow">TOOLBOX</span>
        <h2>Elements</h2>
        <p>Drag onto canvas or select and click.</p>
      </div>
      <div className="sidebar-tabs" role="tablist" aria-label="Palette view">
        <button
          role="tab"
          id="tools-tab"
          aria-controls="tools-panel"
          aria-selected={tab === "tools"}
          onClick={() => setTab("tools")}
        >
          Tools
        </button>
        <button
          role="tab"
          id="model-tab"
          aria-controls="model-panel"
          aria-selected={tab === "model"}
          onClick={() => setTab("model")}
        >
          Model
        </button>
      </div>
      {tab === "model" ? (
        <div role="tabpanel" id="model-panel" aria-labelledby="model-tab">
          <Outline />
        </div>
      ) : (
        <div role="tabpanel" id="tools-panel" aria-labelledby="tools-tab">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search tools"
              placeholder="Search elements…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {filtered.map((item, i) => (
            <div key={item.title}>
              {(i === 0 || item.group !== filtered[i - 1].group) && (
                <div className="palette-section-label">{item.group}</div>
              )}
              <button
                type="button"
                className={`palette-item ${active(item) ? "active" : ""}`}
                aria-pressed={active(item)}
                draggable={item.kind !== "isa"}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/chen-node",
                    JSON.stringify({ kind: item.kind, patch: item.patch }),
                  );
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() =>
                  setTool(active(item) ? null : item.kind, item.patch)
                }
                title={item.description}
              >
                <span className="palette-icon">
                  <ShapeIcon item={item} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            </div>
          ))}
          {!filtered.length && (
            <p className="inspector-note">No matching tools.</p>
          )}
          {!query && (
            <>
              <div className="palette-section-label">
                Specialization presets
              </div>
              <div className="preset-grid">
                {specializationPresets.map((preset) => (
                  <button
                    key={preset.label}
                    title={preset.description}
                    aria-pressed={
                      tool === "specialization" &&
                      toolPatch.constraint === preset.patch.constraint &&
                      toolPatch.completeness === preset.patch.completeness
                    }
                    onClick={() => setTool("specialization", preset.patch)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="palette-guide">
                <strong>Connecting elements</strong>
                <p>
                  Hover a shape and drag a handle to another shape. Entity →
                  diamond adds participation. Entity → d/o → entity adds
                  specialization. Entity → U → entity adds a union category.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
