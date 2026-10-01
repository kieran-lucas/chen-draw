import { useReactFlow } from "@xyflow/react";
import { Search } from "lucide-react";
import { useState } from "react";
import { useEditor } from "../store/editorStore";
import type { StudioNode } from "../model/types";

export function Outline() {
  const [query, setQuery] = useState("");
  const nodes = useEditor((s) => s.nodes),
    edges = useEditor((s) => s.edges);
  const rf = useReactFlow();
  const term = query.toLocaleLowerCase().trim();
  const label = (n: StudioNode) =>
    n.data.kind === "specialization"
      ? `${n.data.constraint} · ${n.data.completeness}`
      : n.data.kind === "category"
        ? `Union · ${n.data.completeness}`
        : n.data.name;
  const matches = nodes.filter((n) =>
    `${label(n)} ${n.data.kind} ${n.data.notes}`
      .toLocaleLowerCase()
      .includes(term),
  );
  return (
    <div className="outline">
      <label className="search-field">
        <Search size={15} />
        <input
          aria-label="Find element"
          placeholder="Find by name or type…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="outline-count">
        {matches.length} of {nodes.length} elements
      </p>
      {!matches.length && (
        <p className="inspector-note">
          {nodes.length
            ? "No matching elements."
            : "Add an element or insert a template to begin."}
        </p>
      )}
      {matches.map((n) => (
        <button
          key={n.id}
          className={`outline-item ${n.selected ? "active" : ""}`}
          onClick={() => {
            useEditor.getState().selectNode(n.id);
            void rf.fitView({
              nodes: [{ id: n.id }],
              padding: 0.8,
              maxZoom: 1.2,
              duration: 250,
            });
          }}
          onDoubleClick={() => {
            if (!["specialization", "category"].includes(n.data.kind))
              useEditor.getState().setEditing(n.id);
          }}
        >
          <span className={`outline-symbol ${n.data.kind}`}>
            {n.data.kind === "relationship"
              ? "◇"
              : n.data.kind === "entity"
                ? "▭"
                : n.data.kind === "category"
                  ? "U"
                  : n.data.kind === "specialization"
                    ? n.data.constraint === "disjoint"
                      ? "d"
                      : "o"
                    : n.data.kind === "attribute"
                      ? "⬭"
                      : "T"}
          </span>
          <span>
            <strong>{label(n) || "Unnamed"}</strong>
            <small>
              {n.data.kind}
              {n.data.weak ? " · weak" : ""}
              {n.data.identifying ? " · identifying" : ""}
            </small>
          </span>
        </button>
      ))}
      {term &&
        edges
          .filter((e) =>
            `${e.data.role} ${e.data.predicate} ${e.data.notes}`
              .toLocaleLowerCase()
              .includes(term),
          )
          .map((e) => (
            <button
              key={e.id}
              className="outline-item"
              onClick={() => {
                useEditor.getState().selectEdge(e.id);
                void rf.fitView({
                  nodes: [{ id: e.source }, { id: e.target }],
                  padding: 0.4,
                  maxZoom: 1.2,
                  duration: 250,
                });
              }}
            >
              <span className="outline-symbol">—</span>
              <span>
                <strong>
                  {e.data.role || e.data.predicate || e.data.kind}
                </strong>
                <small>connector</small>
              </span>
            </button>
          ))}
    </div>
  );
}
