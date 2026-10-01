import { starterDocument } from "./starter";
import {
  DEFAULT_ATTRIBUTE,
  makeEdge,
  makeNode,
  type StudioDocument,
} from "./types";

export interface DiagramTemplate {
  id: string;
  title: string;
  description: string;
  create: () => StudioDocument;
}
const document = (
  title: string,
  nodes: StudioDocument["nodes"],
  edges: StudioDocument["edges"],
): StudioDocument => ({
  version: 1,
  title,
  nodes,
  edges,
  viewport: { x: 0, y: 0, zoom: 1 },
  settings: { grid: true, snap: false },
});

export const templates: DiagramTemplate[] = [
  {
    id: "classic",
    title: "Classic Chen + EER",
    description: "Keys, N:1 participation and a total disjoint specialization.",
    create: starterDocument,
  },
  {
    id: "minmax",
    title: "Min–max participation",
    description:
      "An order has exactly one customer; a customer may place many orders.",
    create: () =>
      document(
        "Customer orders",
        [
          makeNode("customer", "entity", 0, 150, { name: "CUSTOMER" }),
          makeNode("places", "relationship", 280, 138, { name: "PLACES" }),
          makeNode("order", "entity", 550, 150, { name: "ORDER" }),
          makeNode("id", "attribute", 0, 0, {
            name: "Customer_id",
            attribute: { ...DEFAULT_ATTRIBUTE, isKey: true },
          }),
          makeNode("order-id", "attribute", 550, 0, {
            name: "Order_id",
            attribute: { ...DEFAULT_ATTRIBUTE, isKey: true },
          }),
        ],
        [
          makeEdge("p1", "customer", "places", "participation", {
            cardinalityMode: "minmax",
            minimum: "0",
            maximum: "N",
          }),
          makeEdge("p2", "order", "places", "participation", {
            cardinalityMode: "minmax",
            minimum: "1",
            maximum: "1",
            participation: "total",
          }),
          makeEdge("a1", "id", "customer", "attribute"),
          makeEdge("a2", "order-id", "order", "attribute"),
        ],
      ),
  },
  {
    id: "weak",
    title: "Weak entity",
    description:
      "Double rectangle, identifying diamond, total participation and partial key.",
    create: () =>
      document(
        "Employee dependents",
        [
          makeNode("employee", "entity", 0, 150, { name: "EMPLOYEE" }),
          makeNode("has", "relationship", 280, 138, {
            name: "HAS",
            identifying: true,
          }),
          makeNode("dependent", "entity", 550, 150, {
            name: "DEPENDENT",
            weak: true,
          }),
          makeNode("name", "attribute", 550, 0, {
            name: "Name",
            attribute: { ...DEFAULT_ATTRIBUTE, isPartialKey: true },
          }),
        ],
        [
          makeEdge("p1", "employee", "has", "participation", { ratio: "1" }),
          makeEdge("p2", "dependent", "has", "participation", {
            ratio: "N",
            participation: "total",
          }),
          makeEdge("a1", "name", "dependent", "attribute"),
        ],
      ),
  },
  {
    id: "overlap",
    title: "Overlapping subclasses",
    description: "Partial overlap, shared subclass and multiple inheritance.",
    create: () =>
      document(
        "University roles",
        [
          makeNode("person", "entity", 260, 0, { name: "PERSON" }),
          makeNode("group", "specialization", 298, 155, {
            constraint: "overlap",
            completeness: "partial",
          }),
          makeNode("student", "entity", 0, 310, { name: "STUDENT" }),
          makeNode("employee", "entity", 530, 310, { name: "EMPLOYEE" }),
          makeNode("assistant", "entity", 240, 500, {
            name: "TEACHING_ASSISTANT",
          }),
        ],
        [
          makeEdge("parent", "person", "group", "specialization-parent"),
          makeEdge("c1", "group", "student", "specialization-child"),
          makeEdge("c2", "group", "employee", "specialization-child"),
          makeEdge("i1", "student", "assistant", "isa"),
          makeEdge("i2", "employee", "assistant", "isa"),
        ],
      ),
  },
  {
    id: "union",
    title: "Union category",
    description:
      "A U circle combines distinct source entity types into an owner category.",
    create: () =>
      document(
        "Owner category",
        [
          makeNode("person", "entity", 0, 0, { name: "PERSON" }),
          makeNode("company", "entity", 400, 0, { name: "COMPANY" }),
          makeNode("union", "category", 238, 180, { completeness: "total" }),
          makeNode("owner", "entity", 200, 350, { name: "OWNER" }),
        ],
        [
          makeEdge("s1", "person", "union", "category-source"),
          makeEdge("s2", "company", "union", "category-source"),
          makeEdge("target", "union", "owner", "category-target"),
        ],
      ),
  },
  {
    id: "recursive",
    title: "Recursive + ternary",
    description:
      "Supervisor roles and a three-way supply relationship with its own attribute.",
    create: () =>
      document(
        "Supply and supervision",
        [
          makeNode("employee", "entity", 0, 0, { name: "EMPLOYEE" }),
          makeNode("supervises", "relationship", 290, -12, {
            name: "SUPERVISES",
          }),
          makeNode("supplier", "entity", 0, 250, { name: "SUPPLIER" }),
          makeNode("part", "entity", 540, 250, { name: "PART" }),
          makeNode("supply", "relationship", 270, 238, { name: "SUPPLIES" }),
          makeNode("project", "entity", 270, 460, { name: "PROJECT" }),
          makeNode("quantity", "attribute", 280, 100, { name: "Quantity" }),
        ],
        [
          makeEdge("r1", "employee", "supervises", "participation", {
            role: "Supervisor",
            ratio: "1",
            labelOffset: -32,
          }),
          makeEdge("r2", "employee", "supervises", "participation", {
            role: "Supervisee",
            ratio: "N",
            labelOffset: 32,
          }),
          makeEdge("p1", "supplier", "supply", "participation"),
          makeEdge("p2", "part", "supply", "participation"),
          makeEdge("p3", "project", "supply", "participation"),
          makeEdge("a1", "quantity", "supply", "attribute"),
        ],
      ),
  },
  {
    id: "attributes",
    title: "Attribute families",
    description:
      "Composite name, multivalued phone, derived age and a solid underlined key.",
    create: () =>
      document(
        "Person attributes",
        [
          makeNode("person", "entity", 280, 280, { name: "PERSON" }),
          makeNode("id", "attribute", 0, 280, {
            name: "Person_id",
            attribute: { ...DEFAULT_ATTRIBUTE, isKey: true },
          }),
          makeNode("name", "attribute", 280, 120, {
            name: "Name",
            attribute: { ...DEFAULT_ATTRIBUTE, isComposite: true },
          }),
          makeNode("first", "attribute", 140, 0, { name: "First_name" }),
          makeNode("last", "attribute", 420, 0, { name: "Last_name" }),
          makeNode("phone", "attribute", 560, 180, {
            name: "Phone",
            attribute: { ...DEFAULT_ATTRIBUTE, isMultivalued: true },
          }),
          makeNode("age", "attribute", 560, 380, {
            name: "Age",
            attribute: { ...DEFAULT_ATTRIBUTE, isDerived: true },
          }),
        ],
        [
          ...["id", "name", "phone", "age"].map((id) =>
            makeEdge(`a-${id}`, id, "person", "attribute"),
          ),
          makeEdge("first-name", "first", "name", "attribute"),
          makeEdge("last-name", "last", "name", "attribute"),
        ],
      ),
  },
];
