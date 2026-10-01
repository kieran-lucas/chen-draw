import assert from "node:assert/strict";
import test from "node:test";
import { labelPosition, nodeBox } from "../src/geometry/diagram";
import { layoutNodes } from "../src/geometry/layout";
import { templates } from "../src/model/templates";
import { cleanDocument, parseDocument } from "../src/model/serialization";
import { makeEdge, makeNode } from "../src/model/types";
import { validateGraph } from "../src/model/validation";

test("every template is valid and survives a version 1 JSON round trip", () => {
  for (const template of templates) {
    const document = template.create();
    assert.deepEqual(
      validateGraph(document.nodes, document.edges),
      [],
      template.id,
    );
    const clean = cleanDocument(document);
    assert.deepEqual(
      parseDocument(JSON.parse(JSON.stringify(clean))),
      clean,
      template.id,
    );
  }
});

test("tidy layout preserves semantics and prevents shape overlap", () => {
  for (const template of templates) {
    const document = template.create();
    const arranged = layoutNodes(document.nodes, document.edges);
    assert.deepEqual(
      arranged.map((n) => n.data),
      document.nodes.map((n) => n.data),
    );
    assert.deepEqual(
      arranged.map((n) => n.id),
      document.nodes.map((n) => n.id),
    );
    assert.deepEqual(validateGraph(arranged, document.edges), [], template.id);
    assert.deepEqual(
      layoutNodes(document.nodes, document.edges),
      arranged,
      "deterministic layout",
    );
    for (let i = 0; i < arranged.length; i++)
      for (let j = i + 1; j < arranged.length; j++) {
        const a = nodeBox(arranged[i]),
          b = nodeBox(arranged[j]);
        assert.ok(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
          `${template.id}: ${arranged[i].id} overlaps ${arranged[j].id}`,
        );
      }
  }
});

test("orthogonal connector labels follow path length and local offset", () => {
  const edge = makeEdge("edge", "a", "b", "participation", {
    labelT: 0.5,
    labelOffset: 0,
  });
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  ];
  assert.deepEqual(labelPosition(edge, points), { x: 100, y: 50 });
  edge.data.labelOffset = 20;
  assert.deepEqual(labelPosition(edge, points), { x: 80, y: 50 });
  edge.data.labelT = 0.9;
  assert.deepEqual(labelPosition(edge, points), { x: 170, y: 120 });
  assert.deepEqual(
    labelPosition(edge, [
      { x: 1, y: 2 },
      { x: 1, y: 2 },
    ]),
    { x: 1, y: 2 },
  );
});

test("min–max validation catches reversed bounds, malformed values and inconsistent participation", () => {
  const nodes = [
    makeNode("e", "entity", 0, 0),
    makeNode("r", "relationship", 200, 0),
  ];
  const check = (
    minimum: string,
    maximum: string,
    participation: "partial" | "total",
  ) =>
    validateGraph(nodes, [
      makeEdge("p", "e", "r", "participation", {
        cardinalityMode: "minmax",
        minimum,
        maximum,
        participation,
      }),
    ]).filter((w) => w.edgeId === "p");
  assert.deepEqual(check("0", "N", "partial"), []);
  assert.deepEqual(check("1", "1", "total"), []);
  assert.deepEqual(check("2", "*", "total"), []);
  assert.ok(
    check("3", "2", "total").some((w) => w.id.startsWith("minmax-order")),
  );
  assert.ok(
    check("0", "N", "total").some((w) => w.id.startsWith("minmax-total")),
  );
  for (const [minimum, maximum] of [
    ["-1", "N"],
    ["1.5", "N"],
    ["", "N"],
    ["0", "0"],
    ["0", "banana"],
  ])
    assert.ok(
      check(minimum, maximum, "partial").some((w) =>
        w.id.startsWith("minmax-format"),
      ),
    );
});

test("category sources must be distinct and weak identification requires total participation", () => {
  const document = templates.find((t) => t.id === "union")!.create();
  document.edges[1].source = document.edges[0].source;
  assert.ok(
    validateGraph(document.nodes, document.edges).some((w) =>
      w.id.startsWith("category-source"),
    ),
  );
  const weak = templates.find((t) => t.id === "weak")!.create();
  weak.edges.find((e) => e.source === "dependent")!.data.participation =
    "partial";
  assert.ok(
    validateGraph(weak.nodes, weak.edges).some((w) =>
      w.id.startsWith("weak-total"),
    ),
  );
});

test("large inheritance chains validate without recursion, and only cycle members are flagged", () => {
  const nodes = Array.from({ length: 3000 }, (_, i) =>
    makeNode(`n${i}`, "entity", 0, 0, { name: `Entity_${i}` }),
  );
  const edges = nodes
    .slice(1)
    .map((n, i) => makeEdge(`e${i}`, `n${i}`, n.id, "isa"));
  assert.deepEqual(validateGraph(nodes, edges), []);
  edges.push(makeEdge("cycle", "n10", "n5", "isa"));
  const cycleIds = validateGraph(nodes, edges)
    .filter((w) => w.id.startsWith("cycle-"))
    .map((w) => w.nodeId)
    .sort();
  assert.deepEqual(cycleIds, ["n10", "n5", "n6", "n7", "n8", "n9"].sort());
});
