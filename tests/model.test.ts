import assert from "node:assert/strict";
import test from "node:test";
import {
  edgeLabelBoxes,
  edgeMarkup,
  nodeRenderBox,
  shapeMarkup,
} from "../src/geometry/diagram";
import { cleanDocument, parseDocument } from "../src/model/serialization";
import {
  makeEdge,
  makeNode,
  type NodeKind,
  type EdgeKind,
  type StudioNode,
  type StudioEdge,
  type StudioDocument,
} from "../src/model/types";
import { validateGraph } from "../src/model/validation";

function graph() {
  const nodes: StudioNode[] = [],
    edges: StudioEdge[] = [];
  const add = (
    id: string,
    kind: NodeKind,
    patch: Partial<StudioNode["data"]> = {},
  ) => {
    nodes.push(
      makeNode(id, kind, nodes.length * 120, (nodes.length % 3) * 140, {
        name: id.toUpperCase(),
        ...patch,
      }),
    );
    return id;
  };
  const link = (
    source: string,
    target: string,
    kind: EdgeKind,
    patch: Partial<StudioEdge["data"]> = {},
  ) => {
    edges.push(makeEdge(`e${edges.length}`, source, target, kind, patch));
  };
  return { nodes, edges, add, link };
}

test("Chen SVG shapes compose the required meanings", () => {
  const normal = shapeMarkup(makeNode("e", "entity", 0, 0));
  const weak = shapeMarkup(makeNode("w", "entity", 0, 0, { weak: true }));
  const relationship = shapeMarkup(makeNode("r", "relationship", 0, 0));
  const identifying = shapeMarkup(
    makeNode("i", "relationship", 0, 0, { identifying: true }),
  );
  const attribute = shapeMarkup(
    makeNode("a", "attribute", 0, 0, {
      name: "Degrees",
      attribute: {
        isKey: true,
        isPartialKey: false,
        isMultivalued: true,
        isDerived: true,
        isComposite: true,
      },
    }),
  );
  const partial = shapeMarkup(
    makeNode("partial", "attribute", 0, 0, {
      name: "Branch_no",
      attribute: {
        isKey: false,
        isPartialKey: true,
        isMultivalued: false,
        isDerived: false,
        isComposite: false,
      },
    }),
  );
  assert.equal((normal.match(/<rect /g) ?? []).length, 1);
  assert.equal((weak.match(/<rect /g) ?? []).length, 2);
  assert.equal((relationship.match(/<polygon /g) ?? []).length, 1);
  assert.equal((identifying.match(/<polygon /g) ?? []).length, 2);
  assert.equal((attribute.match(/<ellipse /g) ?? []).length, 2);
  assert.match(attribute, /stroke-dasharray="6 4"/);
  assert.match(partial, /stroke-dasharray="3 2"/);
  assert.equal((attribute.match(/<line /g) ?? []).length, 1);
  assert.doesNotMatch(attribute, /\bPK\b|KEY/);
});

test("all four specialization constraints and category completeness render distinctly", () => {
  for (const constraint of ["disjoint", "overlap"] as const)
    for (const completeness of ["partial", "total"] as const) {
      const nodes = [
        makeNode("parent", "entity", 0, 0),
        makeNode("spec", "specialization", 200, 100, {
          constraint,
          completeness,
        }),
        makeNode("child", "entity", 300, 200),
      ];
      const edge = makeEdge("sp", "parent", "spec", "specialization-parent");
      assert.match(
        shapeMarkup(nodes[1]),
        constraint === "disjoint" ? />d<\/text>/ : />o<\/text>/,
      );
      assert.equal(
        (edgeMarkup(edge, nodes, [edge]).match(/<path /g) ?? []).length,
        completeness === "total" ? 2 : 1,
      );
    }
  for (const completeness of ["partial", "total"] as const) {
    const nodes = [
      makeNode("u", "category", 0, 0, { completeness }),
      makeNode("owner", "entity", 300, 0),
    ];
    const edge = makeEdge("cat", "u", "owner", "category-target");
    assert.match(shapeMarkup(nodes[0]), />U<\/text>/);
    assert.equal(
      (edgeMarkup(edge, nodes, [edge]).match(/<path /g) ?? []).length,
      completeness === "total" ? 2 : 1,
    );
  }
});

test("lattices, independent groups, recursive and N-ary relationships, categories, and attribute trees are representable", () => {
  const g = graph();
  for (const id of [
    "person",
    "employee",
    "student",
    "alumnus",
    "student_assistant",
    "research_assistant",
    "teaching_assistant",
    "secretary",
    "engineer",
    "manager",
    "bank",
    "company",
    "owner",
    "vehicle",
    "supplier",
    "part",
    "project",
  ])
    g.add(id, "entity");
  g.add("person_group", "specialization", {
    constraint: "overlap",
    completeness: "partial",
  });
  g.link("person", "person_group", "specialization-parent");
  for (const id of ["employee", "student", "alumnus"])
    g.link("person_group", id, "specialization-child");
  g.link("employee", "student_assistant", "isa");
  g.link("student", "student_assistant", "isa");
  g.add("assistant_group", "specialization", {
    constraint: "disjoint",
    completeness: "total",
  });
  g.link("student_assistant", "assistant_group", "specialization-parent");
  g.link("assistant_group", "research_assistant", "specialization-child");
  g.link("assistant_group", "teaching_assistant", "specialization-child");
  g.add("employee_group", "specialization", {
    constraint: "disjoint",
    completeness: "partial",
  });
  g.link("employee", "employee_group", "specialization-parent");
  g.link("employee_group", "secretary", "specialization-child");
  g.link("employee_group", "engineer", "specialization-child");
  g.link("employee", "manager", "isa");
  g.add("pay_group", "specialization", {
    constraint: "disjoint",
    completeness: "total",
  });
  g.add("salary_employee", "entity");
  g.add("hourly_employee", "entity");
  g.link("employee", "pay_group", "specialization-parent");
  g.link("pay_group", "salary_employee", "specialization-child");
  g.link("pay_group", "hourly_employee", "specialization-child");
  g.add("owner_union", "category", { completeness: "total" });
  for (const id of ["person", "bank", "company"])
    g.link(id, "owner_union", "category-source");
  g.link("owner_union", "owner", "category-target");
  g.add("owns", "relationship");
  g.link("owner", "owns", "participation", { ratio: "M" });
  g.link("vehicle", "owns", "participation", { ratio: "N" });
  g.add("supply", "relationship");
  for (const id of ["supplier", "part", "project"])
    g.link(id, "supply", "participation");
  g.add("supervision", "relationship");
  g.link("employee", "supervision", "participation", {
    role: "Supervisor",
    ratio: "1",
  });
  g.link("employee", "supervision", "participation", {
    role: "Supervisee",
    ratio: "N",
  });
  g.add("degrees", "attribute", {
    attribute: {
      isKey: false,
      isPartialKey: false,
      isMultivalued: true,
      isDerived: false,
      isComposite: true,
    },
  });
  g.add("degree", "attribute");
  g.add("major", "attribute");
  g.link("degrees", "student", "attribute");
  g.link("degree", "degrees", "attribute");
  g.link("major", "degrees", "attribute");
  g.add("hours", "attribute");
  g.link("hours", "supply", "attribute");
  assert.equal(
    g.edges.filter((e) => e.source === "employee" && e.target === "supervision")
      .length,
    2,
  );
  assert.equal(
    g.edges.filter(
      (e) => e.target === "supply" && e.data.kind === "participation",
    ).length,
    3,
  );
  assert.equal(
    g.edges.filter(
      (e) => e.source === "employee" && e.data.kind === "specialization-parent",
    ).length,
    2,
  );
  assert.equal(validateGraph(g.nodes, g.edges).length, 0);
  const doc: StudioDocument = {
    version: 1,
    title: "Textbook lattice",
    nodes: g.nodes,
    edges: g.edges,
    viewport: { x: 12, y: 24, zoom: 0.7 },
    settings: { grid: false, snap: true },
  };
  assert.deepEqual(
    parseDocument(JSON.parse(JSON.stringify(cleanDocument(doc))) as unknown),
    cleanDocument(doc),
  );
});

test("weak entity and identifying relationship semantics remain distinct", () => {
  const g = graph();
  g.add("bank", "entity");
  g.add("branch", "entity", { weak: true });
  g.add("branches", "relationship", { identifying: true });
  g.add("branch_no", "attribute", {
    attribute: {
      isKey: false,
      isPartialKey: true,
      isMultivalued: false,
      isDerived: false,
      isComposite: false,
    },
  });
  g.link("bank", "branches", "participation", { ratio: "1" });
  g.link("branch", "branches", "participation", {
    ratio: "N",
    participation: "total",
  });
  g.link("branch_no", "branch", "attribute");
  assert.equal(validateGraph(g.nodes, g.edges).length, 0);
  const totalEdge = g.edges.find((e) => e.source === "branch")!;
  assert.equal(
    (edgeMarkup(totalEdge, g.nodes, g.edges).match(/<path /g) ?? []).length,
    2,
  );
  assert.match(
    shapeMarkup(g.nodes.find((n) => n.id === "branch_no")!),
    /stroke-dasharray="3 2"/,
  );
});

test("inheritance cycles are warned about while multiple inheritance is valid", () => {
  const g = graph();
  g.add("a", "entity");
  g.add("b", "entity");
  g.add("c", "entity");
  g.link("a", "c", "isa");
  g.link("b", "c", "isa");
  assert.equal(validateGraph(g.nodes, g.edges).length, 0);
  g.link("c", "a", "isa");
  assert.ok(
    validateGraph(g.nodes, g.edges).some((w) => w.message.includes("cycle")),
  );
});

test("an isolated attribute tree has no owner", () => {
  const g = graph();
  g.add("name", "attribute", {
    attribute: {
      isKey: false,
      isPartialKey: false,
      isMultivalued: false,
      isDerived: false,
      isComposite: true,
    },
  });
  g.add("first_name", "attribute");
  g.link("first_name", "name", "attribute");
  assert.equal(
    validateGraph(g.nodes, g.edges).filter((w) =>
      w.message.includes("no owner"),
    ).length,
    2,
  );
});

test("direct IS-A predicate annotations support multiple lines without relationship notation", () => {
  const nodes = [
    makeNode("section", "entity", 0, 0, { name: "SECTION" }),
    makeNode("current", "entity", 0, 250, { name: "CURRENT_SECTION" }),
  ];
  const edge = makeEdge("isa", "section", "current", "isa", {
    predicate: "Qtr = Current_qtr\nAND\nYear = Current_year",
  });
  const markup = edgeMarkup(edge, nodes, [edge]);
  assert.equal((markup.match(/<text /g) ?? []).length, 3);
  assert.doesNotMatch(markup, /<polygon|1:M|crow/i);
  const wide = makeEdge("wide", "section", "current", "isa", {
    predicate:
      "A very long predicate annotation that extends beyond both entity rectangles",
  });
  const label = edgeLabelBoxes(wide, nodes, [wide])[0];
  const entity = nodeRenderBox(nodes[0]);
  assert.ok(
    label.x < entity.x || label.x + label.width > entity.x + entity.width,
  );
});
