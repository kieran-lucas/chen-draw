import { memo } from "react";
import { type EdgeProps } from "@xyflow/react";
import { edgeMarkup, edgePoints } from "../../geometry/diagram";
import type { StudioEdge as StudioEdgeType } from "../../model/types";
import { useEditor } from "../../store/editorStore";

function StudioEdgeComponent({
  id,
  data,
  source,
  target,
}: EdgeProps<StudioEdgeType>) {
  const nodes = useEditor((s) => s.nodes),
    edges = useEditor((s) => s.edges);
  const edge = edges.find((e) => e.id === id) ?? {
    id,
    type: "chen" as const,
    source,
    target,
    data,
  };
  const points = edgePoints(edge, nodes, edges);
  if (!points) return null;
  const d = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  return (
    <g>
      <g className="chen-edge-geometry" dangerouslySetInnerHTML={{ __html: edgeMarkup(edge, nodes, edges) }} />
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth="18"
        className="chen-edge-hit"
      />
    </g>
  );
}
export const StudioEdge = memo(StudioEdgeComponent);
