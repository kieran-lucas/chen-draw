import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { nodeRenderBox, shapeMarkup, edgeMarkup } from "../geometry/diagram";
import { templates } from "../model/templates";
import type { StudioDocument } from "../model/types";

function DiagramPreview({ document }: { document: StudioDocument }) {
  const boxes = document.nodes.map(nodeRenderBox),
    padding = 35;
  const minX = Math.min(...boxes.map((b) => b.x)) - padding,
    minY = Math.min(...boxes.map((b) => b.y)) - padding;
  const maxX = Math.max(...boxes.map((b) => b.x + b.width)) + padding,
    maxY = Math.max(...boxes.map((b) => b.y + b.height)) + padding;
  const markup =
    document.edges
      .map((e) => edgeMarkup(e, document.nodes, document.edges))
      .join("") +
    document.nodes
      .map(
        (n) =>
          `<g transform="translate(${n.position.x} ${n.position.y})">${shapeMarkup(n)}</g>`,
      )
      .join("");
  return (
    <svg
      className="template-preview"
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export function StudioDialog({
  mode,
  onClose,
  onInsert,
}: {
  mode: "templates" | "guide";
  onClose: () => void;
  onInsert: (document: StudioDocument) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="studio-dialog"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="sidebar-eyebrow">CHEN STUDIO</span>
          <h2 id="dialog-title">
            {mode === "templates"
              ? "Start with a model"
              : "Chen & EER notation"}
          </h2>
          <p>
            {mode === "templates"
              ? "Insert an editable example into your diagram. Every insertion can be undone."
              : "A reference for the shapes and constraints in your conceptual model."}
          </p>
        </div>
        <button
          className="icon-action"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      {mode === "templates" ? (
        <div className="template-grid">
          {templates.map((template) => {
            const doc = template.create();
            return (
              <button
                key={template.id}
                className="template-card"
                onClick={() => {
                  onInsert(doc);
                  onClose();
                }}
              >
                <DiagramPreview document={doc} />
                <strong>{template.title}</strong>
                <span>{template.description}</span>
                <small>Insert example →</small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="notation-guide">
          <section>
            <h3>Classical Chen shapes</h3>
            <dl>
              <dt>Rectangle / double rectangle</dt>
              <dd>
                Entity / weak entity. A weak entity is identified through its
                owner and an identifying relationship.
              </dd>
              <dt>Diamond / double diamond</dt>
              <dd>
                Relationship / identifying relationship. A recursive
                relationship connects the same entity to a diamond twice, with
                separate role names. An N-ary relationship connects three or
                more participations.
              </dd>
              <dt>Oval and underline</dt>
              <dd>
                Attribute. A solid underline marks a key; a dashed underline
                marks a weak entity’s partial key. A double oval means
                multivalued; a dashed oval means derived. Composite attributes
                connect to component ovals.
              </dd>
            </dl>
          </section>
          <section>
            <h3>Participation and min–max</h3>
            <p>
              A single line means partial participation; a double line means
              total participation. The inspector supports 1/M/N ratios and
              (min,max).
            </p>
            <div className="guide-presets">
              <code>(0,1)</code>
              <span>Optional, at most one</span>
              <code>(1,1)</code>
              <span>Exactly one</span>
              <code>(0,N)</code>
              <span>Optional, many</span>
              <code>(1,N)</code>
              <span>At least one, many</span>
            </div>
            <p>
              A min–max label next to an entity describes how often each
              instance participates in that relationship. Min 0 is partial; min
              ≥ 1 is total. Ratio labels describe the relationship’s cardinality
              ratio; changing display modes keeps your entered values, so check
              their meaning.
            </p>
          </section>
          <section>
            <h3>Specialization and generalization</h3>
            <p>
              Connect superclass → d/o circle → subclasses. Each circle is an
              independent group.
            </p>
            <div className="guide-presets">
              <code>d / partial</code>
              <span>At most one subclass, possibly none</span>
              <code>d / total</code>
              <span>Exactly one subclass</span>
              <code>o / partial</code>
              <span>Multiple subclasses allowed, possibly none</span>
              <code>o / total</code>
              <span>At least one subclass, multiple allowed</span>
            </div>
            <p>
              The circle shows d for disjoint and o for overlap. Total
              completeness draws a double line between superclass and circle.
              Direct IS-A connects superclass → subclass; multiple parents
              create a shared subclass.
            </p>
          </section>
          <section>
            <h3>Union category</h3>
            <p>
              Connect two or more distinct source entity types → U circle →
              category entity. Partial/total completeness controls the line from
              U to the category entity.
            </p>
          </section>
          <section>
            <h3>Keyboard and navigation</h3>
            <div className="guide-presets">
              <code>Ctrl/Cmd + Z</code>
              <span>Undo; add Shift to redo</span>
              <code>Ctrl/Cmd + C / V / D</code>
              <span>Copy / paste / duplicate</span>
              <code>Ctrl/Cmd + S / A</code>
              <span>Save / select all</span>
              <code>E / R / A / S / T</code>
              <span>
                Entity / relationship / attribute / specialization / text
              </span>
              <code>Arrow keys</code>
              <span>Move selection; Shift for a larger step</span>
              <code>F / Shift + F</code>
              <span>Fit diagram / fit selection</span>
              <code>F2 / Delete / Esc</code>
              <span>Rename / delete / cancel</span>
              <code>Shift + drag</code>
              <span>Select multiple elements</span>
              <code>?</code>
              <span>Open this reference</span>
            </div>
          </section>
        </div>
      )}
    </dialog>
  );
}
