import assert from "node:assert/strict";
import test from "node:test";
import { cleanDocument } from "../src/model/serialization";
import { templates } from "../src/model/templates";
import { starterDocument } from "../src/model/starter";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
});
const { useEditor, STORAGE } = await import("../src/store/editorStore");
const reset = () =>
  useEditor.setState({
    ...cleanDocument(starterDocument()),
    past: [],
    future: [],
    gesture: null,
    editingId: null,
    activeTool: null,
    toolPatch: {},
    status: "saved",
  });

test("New and Import each restore the complete previous document with a single undo", () => {
  reset();
  const before = cleanDocument(useEditor.getState());
  useEditor.getState().newDocument();
  assert.equal(useEditor.getState().nodes.length, 0);
  useEditor.getState().undo();
  assert.deepEqual(cleanDocument(useEditor.getState()), before);
  useEditor.getState().redo();
  assert.equal(useEditor.getState().nodes.length, 0);
  useEditor.getState().undo();
  const next = templates.find((t) => t.id === "union")!.create();
  next.viewport = { x: -70, y: 31, zoom: 0.6 };
  next.settings = { grid: false, snap: true };
  useEditor.getState().replaceDocument(next);
  assert.deepEqual(cleanDocument(useEditor.getState()), cleanDocument(next));
  useEditor.getState().undo();
  assert.deepEqual(cleanDocument(useEditor.getState()), before);
  useEditor.getState().redo();
  assert.deepEqual(cleanDocument(useEditor.getState()), cleanDocument(next));
});

test("repeated template insertion remaps endpoints and is atomic without touching the clipboard", () => {
  reset();
  const template = templates.find((t) => t.id === "weak")!.create();
  const before = cleanDocument(useEditor.getState());
  const clipboard = useEditor.getState().clipboard;
  useEditor.getState().insertTemplate(template, 1000, 200);
  const once = cleanDocument(useEditor.getState());
  useEditor.getState().insertTemplate(template, 2000, 200);
  const twice = useEditor.getState(),
    ids = new Set(twice.nodes.map((n) => n.id));
  assert.equal(ids.size, twice.nodes.length);
  assert.ok(twice.edges.every((e) => ids.has(e.source) && ids.has(e.target)));
  assert.equal(twice.title, before.title);
  assert.equal(twice.clipboard, clipboard);
  useEditor.getState().undo();
  assert.deepEqual(cleanDocument(useEditor.getState()), once);
  useEditor.getState().undo();
  assert.deepEqual(cleanDocument(useEditor.getState()), before);
});

test("connected component creation and held arrow movement undo as complete gestures", () => {
  reset();
  const before = cleanDocument(useEditor.getState());
  const id = useEditor.getState().addRelatedNode("employee", "attribute");
  assert.ok(id);
  assert.ok(
    useEditor
      .getState()
      .edges.some((e) => e.source === id && e.target === "employee"),
  );
  useEditor.getState().beginGesture();
  for (let i = 0; i < 20; i++) useEditor.getState().nudge(1, 0);
  useEditor.getState().endGesture();
  const moved = useEditor.getState().nodes.find((n) => n.id === id)!.position.x;
  useEditor.getState().undo();
  assert.equal(
    useEditor.getState().nodes.find((n) => n.id === id)!.position.x,
    moved - 20,
  );
  useEditor.getState().undo();
  assert.deepEqual(cleanDocument(useEditor.getState()), before);
});

test("weak identifying connections get double lines and the saved JSON includes their semantics", () => {
  reset();
  const weak = useEditor.getState().addNode("entity", 10, 20, { weak: true });
  const identifying = useEditor
    .getState()
    .addNode("relationship", 200, 20, { identifying: true });
  assert.equal(useEditor.getState().connect(weak, identifying), true);
  assert.equal(useEditor.getState().edges.at(-1)!.data.participation, "total");
  useEditor.getState().saveNow();
  assert.equal(
    JSON.parse(storage.get(STORAGE)!).edges.at(-1).data.participation,
    "total",
  );
});
