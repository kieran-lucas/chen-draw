import { cloneElement, isValidElement, useId, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { Plus, Trash2, Copy, Scan } from "lucide-react";
import { validateGraph } from "../model/validation";
import {
  DEFAULT_ATTRIBUTE,
  type StudioEdge,
  type StudioNode,
} from "../model/types";
import { cardinalityPresets, specializationPresets } from "../model/presets";
import {
  edgeIsDouble,
  edgeLabel,
  nodeSize,
  shapeMarkup,
} from "../geometry/diagram";
import { useEditor } from "../store/editorStore";

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      {isValidElement<{ id?: string; "aria-labelledby"?: string }>(children)
        ? cloneElement(children, { id, "aria-labelledby": `${id}-label` })
        : children}
    </label>
  );
};
function NodeFields({ node }: { node: StudioNode }) {
  const rf = useReactFlow();
  const update = useEditor((s) => s.updateNode),
    d = node.data;
  const addRelated = (kind: StudioNode["data"]["kind"], patch = {}) => {
    const id = useEditor.getState().addRelatedNode(node.id, kind, patch);
    if (id)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          void rf.fitView({
            nodes: [{ id: node.id }, { id }],
            padding: 0.5,
            maxZoom: 1.2,
            duration: 0,
          });
          if (!["specialization", "category"].includes(kind))
            useEditor.getState().setEditing(id);
        }),
      );
  };
  const size = nodeSize(node);
  const text = (label: string, key: "name" | "notes" | "defining") => (
    <Field label={label}>
      {d.kind === "annotation" ? (
        <textarea
          rows={4}
          value={String(d[key])}
          onChange={(e) => update(node.id, { [key]: e.target.value })}
        />
      ) : (
        <input
          value={String(d[key])}
          onChange={(e) => update(node.id, { [key]: e.target.value })}
        />
      )}
    </Field>
  );
  const checkbox = (label: string, key: keyof typeof d.attribute) => (
    <label className="check" key={key}>
      <input
        type="checkbox"
        checked={d.attribute[key]}
        onChange={(e) => {
          const attribute = { ...d.attribute, [key]: e.target.checked };
          if (key === "isKey" && e.target.checked)
            attribute.isPartialKey = false;
          if (key === "isPartialKey" && e.target.checked)
            attribute.isKey = false;
          update(node.id, { attribute });
        }}
      />
      <span>{label}</span>
    </label>
  );
  return (
    <div className="inspector-section">
      <div className="inspector-type">
        {d.kind === "specialization"
          ? "Specialization group"
          : d.kind === "category"
            ? "Category / union"
            : d.kind}
      </div>
      <div className="notation-preview">
        <svg
          width="100%"
          height="70"
          viewBox={`-12 -32 ${size.width + 24} ${size.height + 52}`}
          aria-label="Notation preview"
          dangerouslySetInnerHTML={{ __html: shapeMarkup(node) }}
        />
      </div>
      {d.kind !== "specialization" &&
        d.kind !== "category" &&
        text(d.kind === "annotation" ? "Text" : "Name", "name")}
      {d.kind === "entity" && (
        <>
          <div className="field-label">Entity type</div>
          <div className="segmented">
            <button
              className={!d.weak ? "active" : ""}
              onClick={() => update(node.id, { weak: false })}
            >
              Normal
            </button>
            <button
              className={d.weak ? "active" : ""}
              onClick={() => update(node.id, { weak: true })}
            >
              Weak
            </button>
          </div>
        </>
      )}
      {d.kind === "relationship" && (
        <>
          <div className="field-label">Relationship type</div>
          <div className="segmented">
            <button
              className={!d.identifying ? "active" : ""}
              onClick={() => update(node.id, { identifying: false })}
            >
              Normal
            </button>
            <button
              className={d.identifying ? "active" : ""}
              onClick={() => update(node.id, { identifying: true })}
            >
              Identifying
            </button>
          </div>
        </>
      )}
      {d.kind === "attribute" && (
        <>
          <div className="field-label">Attribute notation</div>
          {checkbox("Key (solid underline)", "isKey")}
          {checkbox("Partial key (dashed underline)", "isPartialKey")}
          {checkbox("Multivalued (double oval)", "isMultivalued")}
          {checkbox("Derived (dashed oval)", "isDerived")}
          {checkbox("Composite (component attributes)", "isComposite")}
          <p className="inspector-note">
            Properties can be combined. Connect component ovals to this oval.
          </p>
        </>
      )}
      {d.kind === "specialization" && (
        <>
          <div className="preset-grid" aria-label="Specialization presets">
            {specializationPresets.map((preset) => (
              <button
                key={preset.label}
                title={preset.description}
                aria-pressed={
                  d.constraint === preset.patch.constraint &&
                  d.completeness === preset.patch.completeness
                }
                onClick={() => update(node.id, preset.patch)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Field label="Constraint">
            <select
              value={d.constraint}
              onChange={(e) =>
                update(node.id, {
                  constraint: e.target.value as typeof d.constraint,
                })
              }
            >
              <option value="disjoint">Disjoint (d)</option>
              <option value="overlap">Overlapping (o)</option>
            </select>
          </Field>
          <Field label="Completeness">
            <select
              value={d.completeness}
              onChange={(e) =>
                update(node.id, {
                  completeness: e.target.value as typeof d.completeness,
                })
              }
            >
              <option value="partial">Partial — single line</option>
              <option value="total">Total — double line</option>
            </select>
          </Field>
          {text("Defining attribute / predicate", "defining")}
          <p className="semantic-summary">
            {
              specializationPresets.find(
                (p) =>
                  p.patch.constraint === d.constraint &&
                  p.patch.completeness === d.completeness,
              )?.description
            }
            .
          </p>
          <p className="inspector-note">
            Connect one superclass to the circle, then connect each subclass
            from the circle. Separate circles make independent groups.
          </p>
        </>
      )}
      {d.kind === "category" && (
        <>
          <Field label="Category completeness">
            <select
              value={d.completeness}
              onChange={(e) =>
                update(node.id, {
                  completeness: e.target.value as typeof d.completeness,
                })
              }
            >
              <option value="partial">Partial — single line</option>
              <option value="total">Total — double line</option>
            </select>
          </Field>
          <p className="inspector-note">
            Connect at least two source entities to U, then connect U to the
            category entity.
          </p>
        </>
      )}
      {d.kind === "annotation" && (
        <>
          <Field label="Font size">
            <input
              type="number"
              min="9"
              max="48"
              value={d.fontSize}
              onChange={(e) =>
                update(node.id, {
                  fontSize: Math.max(
                    9,
                    Math.min(48, Number(e.target.value) || 16),
                  ),
                })
              }
            />
          </Field>
          <Field label="Alignment">
            <select
              value={d.align}
              onChange={(e) =>
                update(node.id, { align: e.target.value as typeof d.align })
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Field>
        </>
      )}
      {d.kind !== "annotation" && (
        <Field label="Notes">
          <textarea
            rows={3}
            value={d.notes}
            onChange={(e) => update(node.id, { notes: e.target.value })}
          />
        </Field>
      )}
      {["entity", "relationship", "attribute"].includes(d.kind) && (
        <div className="related-actions">
          <div className="field-label">Add connected element</div>
          <button onClick={() => addRelated("attribute")}>
            <Plus size={13} />
            {d.kind === "attribute" ? "Component attribute" : "Attribute"}
          </button>
          {d.kind === "entity" && (
            <>
              <button
                onClick={() =>
                  addRelated("attribute", {
                    attribute: { ...DEFAULT_ATTRIBUTE, isKey: true },
                  })
                }
              >
                <Plus size={13} />
                Key attribute
              </button>
              <button onClick={() => addRelated("entity")}>
                <Plus size={13} />
                Direct subclass
              </button>
              <button onClick={() => addRelated("specialization")}>
                <Plus size={13} />
                Specialization group
              </button>
            </>
          )}
        </div>
      )}
      {d.kind === "specialization" && (
        <div className="related-actions">
          <button onClick={() => addRelated("entity")}>
            <Plus size={13} />
            Add subclass
          </button>
        </div>
      )}
    </div>
  );
}
function EdgeFields({ edge }: { edge: StudioEdge }) {
  const update = useEditor((s) => s.updateEdge),
    d = edge.data;
  return (
    <div className="inspector-section">
      <div className="inspector-type">{d.kind.replace("-", " ")} connector</div>
      {d.kind === "participation" && (
        <>
          <div className="semantic-summary">
            {edgeLabel(edge) || "No cardinality label"} · {d.participation}{" "}
            participation
          </div>
          <div className="field-label">Min–max presets</div>
          <div className="preset-grid">
            {cardinalityPresets.map((preset) => (
              <button
                key={preset.label}
                title={preset.description}
                aria-pressed={
                  d.cardinalityMode === "minmax" &&
                  d.minimum === preset.patch.minimum &&
                  d.maximum === preset.patch.maximum &&
                  d.participation === preset.patch.participation
                }
                onClick={() =>
                  update(edge.id, {
                    ...preset.patch,
                    cardinalityMode: "minmax",
                  })
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Field label="Role name">
            <input
              value={d.role}
              onChange={(e) => update(edge.id, { role: e.target.value })}
              placeholder="Optional role"
            />
          </Field>
          <Field label="Cardinality display">
            <select
              value={d.cardinalityMode}
              onChange={(e) =>
                update(edge.id, {
                  cardinalityMode: e.target.value as typeof d.cardinalityMode,
                  ...(e.target.value === "minmax"
                    ? {
                        minimum:
                          d.participation === "total" && Number(d.minimum) === 0
                            ? "1"
                            : d.participation === "partial" &&
                                Number(d.minimum) > 0
                              ? "0"
                              : d.minimum,
                      }
                    : {}),
                })
              }
            >
              <option value="ratio">Ratio</option>
              <option value="minmax">Min–Max</option>
              <option value="none">None</option>
            </select>
          </Field>
          {d.cardinalityMode === "ratio" && (
            <>
              <Field label="Ratio">
                <input
                  value={d.ratio}
                  onChange={(e) => update(edge.id, { ratio: e.target.value })}
                  placeholder="1, M, N or custom"
                />
              </Field>
              <div className="preset-grid ratio-presets">
                {["1", "M", "N"].map((ratio) => (
                  <button
                    key={ratio}
                    aria-pressed={d.ratio === ratio}
                    onClick={() => update(edge.id, { ratio })}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </>
          )}
          {d.cardinalityMode === "minmax" && (
            <>
              <div className="two-fields">
                <Field label="Minimum">
                  <input
                    value={d.minimum}
                    onChange={(e) =>
                      update(edge.id, { minimum: e.target.value })
                    }
                  />
                </Field>
                <Field label="Maximum">
                  <input
                    value={d.maximum}
                    onChange={(e) =>
                      update(edge.id, { maximum: e.target.value })
                    }
                  />
                </Field>
              </div>
              <p className="inspector-note">
                Each instance of the entity participates between min and max
                times. Use N, M, * or ∞ for an unbounded maximum.
              </p>
            </>
          )}
          <Field label="Participation">
            <select
              value={d.participation}
              onChange={(e) =>
                update(edge.id, {
                  participation: e.target.value as typeof d.participation,
                })
              }
            >
              <option value="partial">Partial — single line</option>
              <option value="total">Total — double line</option>
            </select>
          </Field>
        </>
      )}
      {["participation", "isa"].includes(d.kind) && (
        <>
          <Field label="Label position">
            <input
              type="range"
              min="0.08"
              max="0.92"
              step="0.01"
              value={d.labelT}
              onChange={(e) =>
                update(edge.id, { labelT: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Label offset">
            <input
              type="range"
              min="-60"
              max="60"
              step="1"
              value={d.labelOffset}
              onChange={(e) =>
                update(edge.id, { labelOffset: Number(e.target.value) })
              }
            />
          </Field>
        </>
      )}
      {["specialization-parent", "category-target"].includes(d.kind) && (
        <p className="inspector-note">
          Single/double line follows completeness on the{" "}
          {d.kind === "specialization-parent" ? "d/o" : "U"} circle. Select the
          circle to change it.
        </p>
      )}
      {d.kind === "isa" && (
        <Field label="Membership predicate">
          <textarea
            rows={3}
            value={d.predicate}
            onChange={(e) => update(edge.id, { predicate: e.target.value })}
            placeholder="Optional predicate"
          />
        </Field>
      )}
      <Field label="Connector style">
        <select
          value={d.connector}
          onChange={(e) =>
            update(edge.id, { connector: e.target.value as typeof d.connector })
          }
        >
          <option value="straight">Straight</option>
          <option value="orthogonal">Orthogonal</option>
        </select>
      </Field>
      <Field label="Notes">
        <textarea
          rows={3}
          value={d.notes}
          onChange={(e) => update(edge.id, { notes: e.target.value })}
        />
      </Field>
    </div>
  );
}
export function Inspector() {
  const rf = useReactFlow();
  const nodes = useEditor((s) => s.nodes),
    edges = useEditor((s) => s.edges),
    selectNode = useEditor((s) => s.selectNode),
    selectEdge = useEditor((s) => s.selectEdge),
    align = useEditor((s) => s.align);
  const selectedNodes = nodes.filter((n) => n.selected),
    selectedEdges = edges.filter((e) => e.selected);
  const warnings = useMemo(() => validateGraph(nodes, edges), [nodes, edges]);
  const focus = (ids: string[]) =>
    void rf.fitView({
      nodes: ids.map((id) => ({ id })),
      padding: 0.5,
      maxZoom: 1.2,
      duration: 250,
    });
  const selectedIds = selectedNodes.map((n) => n.id);
  const connections =
    selectedNodes.length === 1
      ? edges.filter(
          (e) =>
            e.source === selectedNodes[0].id ||
            e.target === selectedNodes[0].id,
        )
      : [];
  return (
    <aside
      className="sidebar inspector"
      aria-label="Properties inspector"
      onFocusCapture={(e) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        )
          useEditor.getState().beginGesture();
      }}
      onBlurCapture={(e) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        )
          useEditor.getState().endGesture();
      }}
    >
      <div className="sidebar-heading">
        <span className="sidebar-eyebrow">INSPECTOR</span>
        <h2>Properties</h2>
        <p>
          {selectedNodes.length + selectedEdges.length
            ? `${selectedNodes.length + selectedEdges.length} selected`
            : "Select a shape or connector"}
        </p>
      </div>
      {selectedNodes.length === 1 && selectedEdges.length === 0 && (
        <NodeFields node={selectedNodes[0]} />
      )}
      {selectedEdges.length === 1 && selectedNodes.length === 0 && (
        <EdgeFields edge={selectedEdges[0]} />
      )}
      {selectedNodes.length + selectedEdges.length > 0 && (
        <div className="selection-actions">
          <button
            title="Focus selection"
            aria-label="Focus selection"
            onClick={() =>
              focus(
                selectedNodes.length
                  ? selectedIds
                  : selectedEdges.flatMap((e) => [e.source, e.target]),
              )
            }
          >
            <Scan size={15} />
          </button>
          <button
            title="Duplicate selection"
            aria-label="Duplicate selection"
            disabled={!selectedNodes.length}
            onClick={() => useEditor.getState().duplicate()}
          >
            <Copy size={15} />
          </button>
          <button
            className="danger-action"
            title="Delete selection"
            aria-label="Delete selection"
            onClick={() => useEditor.getState().removeSelected()}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
      {!!connections.length && (
        <div className="inspector-section">
          <div className="field-label">Connections · {connections.length}</div>
          {connections.map((e) => {
            const other = nodes.find(
              (n) =>
                n.id ===
                (e.source === selectedNodes[0].id ? e.target : e.source),
            );
            return (
              <button
                key={e.id}
                className="connection-item"
                onClick={() => {
                  selectEdge(e.id);
                  focus([e.source, e.target]);
                }}
              >
                <strong>
                  {other?.data.kind === "specialization"
                    ? `${other.data.constraint} group`
                    : other?.data.name}
                </strong>
                <small>
                  {e.data.kind.replace(/-/g, " ")}
                  {edgeLabel(e) ? ` · ${edgeLabel(e)}` : ""}
                  {edgeIsDouble(e, nodes) ? " · double line" : ""}
                </small>
              </button>
            );
          })}
        </div>
      )}
      {selectedNodes.length >= 2 && (
        <div className="inspector-section">
          <div className="inspector-type">Align selection</div>
          <div className="align-grid">
            {(
              [
                ["left", "Left"],
                ["center", "Center"],
                ["right", "Right"],
                ["top", "Top"],
                ["middle", "Middle"],
                ["bottom", "Bottom"],
                ["distribute-h", "Distribute H"],
                ["distribute-v", "Distribute V"],
              ] as const
            ).map(([mode, label]) => (
              <button key={mode} onClick={() => align(mode)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {!selectedNodes.length && !selectedEdges.length && (
        <div className="empty-inspector">
          <div className="empty-graphic">◇</div>
          <p>
            Classical Chen notation, with EER specialization and union types.
          </p>
          <small>
            Drag an element from the left. Connect shapes by dragging from their
            handles.
          </small>
        </div>
      )}
      <div className="warnings">
        <div className="warnings-title">
          Model checks <span>{warnings.length}</span>
        </div>
        {warnings.length ? (
          warnings.map((w) => (
            <button
              key={w.id}
              className="warning"
              onClick={() => {
                w.nodeId
                  ? selectNode(w.nodeId)
                  : w.edgeId
                    ? selectEdge(w.edgeId)
                    : undefined;
                const edge = edges.find((e) => e.id === w.edgeId);
                if (w.nodeId) focus([w.nodeId]);
                else if (edge) focus([edge.source, edge.target]);
              }}
            >
              {w.message}
            </button>
          ))
        ) : (
          <p className="all-clear">No semantic warnings</p>
        )}
      </div>
    </aside>
  );
}
