import {
  makeEdge,
  makeNode,
  type StudioDocument,
  type StudioEdge,
  type StudioNode,
} from "./types";

export function starterDocument(): StudioDocument {
  const nodes: StudioNode[] = [
    makeNode("employee", "entity", 270, 230, { name: "EMPLOYEE" }),
    makeNode("department", "entity", 800, 230, { name: "DEPARTMENT" }),
    makeNode("works-for", "relationship", 540, 225, { name: "WORKS_FOR" }),
    makeNode("ssn", "attribute", 90, 95, {
      name: "Ssn",
      attribute: {
        isKey: true,
        isPartialKey: false,
        isMultivalued: false,
        isDerived: false,
        isComposite: false,
      },
    }),
    makeNode("employee-name", "attribute", 270, 75, { name: "Name" }),
    makeNode("dept-number", "attribute", 825, 100, {
      name: "Number",
      attribute: {
        isKey: true,
        isPartialKey: false,
        isMultivalued: false,
        isDerived: false,
        isComposite: false,
      },
    }),
    makeNode("dept-name", "attribute", 1030, 100, { name: "Name" }),
    makeNode("spec", "specialization", 375, 420, {
      constraint: "disjoint",
      completeness: "total",
    }),
    makeNode("engineer", "entity", 200, 570, { name: "ENGINEER" }),
    makeNode("secretary", "entity", 510, 570, { name: "SECRETARY" }),
  ];
  const edges: StudioEdge[] = [
    makeEdge("e1", "employee", "works-for", "participation", {
      ratio: "N",
      participation: "total",
    }),
    makeEdge("e2", "department", "works-for", "participation", { ratio: "1" }),
    makeEdge("e3", "ssn", "employee", "attribute"),
    makeEdge("e4", "employee-name", "employee", "attribute"),
    makeEdge("e5", "dept-number", "department", "attribute"),
    makeEdge("e6", "dept-name", "department", "attribute"),
    makeEdge("e7", "employee", "spec", "specialization-parent"),
    makeEdge("e8", "spec", "engineer", "specialization-child"),
    makeEdge("e9", "spec", "secretary", "specialization-child"),
  ];
  return {
    version: 1,
    title: "University EER",
    nodes,
    edges,
    viewport: { x: 30, y: 70, zoom: 0.85 },
    settings: { grid: true, snap: false },
  };
}
