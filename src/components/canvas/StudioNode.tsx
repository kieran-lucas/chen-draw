import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useEffect, useRef, useState } from "react";
import { nodeSize, shapeMarkup } from "../../geometry/diagram";
import type { StudioNode as StudioNodeType } from "../../model/types";
import { useEditor } from "../../store/editorStore";

const positions = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
];
const at: Record<Position, React.CSSProperties> = {
  [Position.Top]: { top: 0, left: "50%" },
  [Position.Right]: { right: 0, top: "50%" },
  [Position.Bottom]: { bottom: 0, left: "50%" },
  [Position.Left]: { left: 0, top: "50%" },
};

function StudioNodeComponent({
  id,
  data,
  selected,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<StudioNodeType>) {
  const editingId = useEditor((s) => s.editingId),
    updateNode = useEditor((s) => s.updateNode),
    setEditing = useEditor((s) => s.setEditing);
  const [draft, setDraft] = useState(data.name),
    input = useRef<HTMLInputElement | HTMLTextAreaElement>(null),
    editDone = useRef(false);
  const editing = editingId === id;
  useEffect(() => {
    if (editing) {
      editDone.current = false;
      setDraft(data.name);
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    }
  }, [editing]);
  const commit = () => {
    if (editDone.current) return;
    editDone.current = true;
    if (draft !== data.name)
      updateNode(id, { name: draft.trim() || data.name });
    setEditing(null);
  };
  const cancel = () => {
    editDone.current = true;
    setDraft(data.name);
    setEditing(null);
  };
  const node = {
    id,
    type: "studio" as const,
    data,
    position: { x: positionAbsoluteX, y: positionAbsoluteY },
  };
  const { width, height } = nodeSize(node);
  return (
    <div
      className={`studio-node ${selected ? "is-selected" : ""} ${data.kind}`}
      style={{ width, height }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (data.kind !== "specialization" && data.kind !== "category")
          setEditing(id);
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label={`${data.kind}: ${data.name}`}
        role="img"
        dangerouslySetInnerHTML={{ __html: shapeMarkup(node) }}
      />
      {editing &&
        (data.kind === "annotation" ? (
          <textarea
            ref={input as React.RefObject<HTMLTextAreaElement>}
            className="inline-rename nodrag nowheel"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
            }}
          />
        ) : (
          <input
            ref={input as React.RefObject<HTMLInputElement>}
            className="inline-rename nodrag"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") cancel();
              if (e.key === "Enter") commit();
            }}
          />
        ))}
      {data.kind !== "annotation" &&
        positions.map((position, i) => (
          <span key={position}>
            <Handle
              type="source"
              id={`s-${i}`}
              position={position}
              style={at[position]}
              className="chen-handle"
            />
            <Handle
              type="target"
              id={`t-${i}`}
              position={position}
              style={at[position]}
              className="chen-handle target-handle"
            />
          </span>
        ))}
    </div>
  );
}
export const StudioNode = memo(StudioNodeComponent);
