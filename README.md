# Chen Studio

Chen Studio is a local, browser based editor for classical Chen ER and Elmasri/Navathe EER diagrams. It is intended for conceptual database modeling and clean coursework or report figures. It uses neither Crow's Foot notation nor SQL table boxes.

## Run

Requires Node.js 20.19+ or 22.12+ (Node 24 is also supported).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

### Windows desktop app

Run `npm run desktop:install` from the project folder. It builds a packaged Electron app in `release/Chen Studio-win32-x64`, copies it to `%LOCALAPPDATA%\Chen Studio`, and creates **Chen Studio** on the Desktop. The shortcut opens `Chen Studio.exe` directly. The installed app includes its own runtime; Node.js and Chrome/Edge are only needed for development, not for opening the shortcut.

The desktop app uses its own local storage. If you used the earlier browser version, export the diagram as JSON there and import it in the desktop app. Export JSON periodically for a portable backup.

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run test:smoke` runs a browser interaction and export check with a local Chrome or Edge installation. Set `CHROME_PATH` if the browser is elsewhere.
`npm run test:features` checks templates, constraint presets, connected attributes, document and layout undo, navigation, immediate save/reload, and narrow screens in the browser.
`npm run test:desktop` checks the packaged Windows app, including local save and reload, using a temporary profile.

## Modeling

Drag an element from the palette onto the canvas, or select a palette tool and click the canvas. A new named element opens for inline renaming. Hover over a shape to reveal connection handles; drag a handle to another shape. The inspector edits the selected shape or connector. Double click a named element to rename it.

- **ER:** entities and weak entities, relationship and identifying diamonds, attributes, key and partial key underlines, multivalued and derived ovals, composite attribute trees, relationship attributes, recursive participations, and N-ary relationships.
- **Participation:** single or double lines, ratio or min–max cardinality, role names, label position, and straight or orthogonal connectors.
- **EER:** direct IS-A links, independent d/o specialization groups with partial or total completeness, unlimited nested and shared subclasses, and U categories with two or more source entity types and partial or total completeness. Direct IS-A can be made with the palette tool or by connecting a superclass entity to a subclass entity.
- **Annotations:** free text and optional membership predicates for direct IS-A and specialization groups.

Connector direction matters for EER: superclass → specialization circle → subclass; source entity types → U circle → category entity. Direct superclass → subclass is a plain IS-A connector. A shared subclass may have multiple incoming IS-A or specialization connections.

The initial diagram is editable and appears only until a document is saved. **New diagram** creates an empty document. Changes and viewport settings auto-save in local storage.

## Faster modeling

- **Templates:** insert any of seven editable examples into the current canvas: classic Chen/EER, min–max, weak entities, overlapping/shared subclasses, union category, recursive/ternary relationships, and attribute families. Inserted elements are selected and framed in view. Each insertion is a single undo step.
- **Notation presets:** create key, partial key, multivalued, derived, and composite attributes directly from the toolbox. Use all four disjoint/overlap × partial/total specialization presets. Participation presets `(0,1)`, `(1,1)`, `(0,N)`, and `(1,N)` set min–max and the corresponding single/double line together.
- **Model tab:** search elements by name, kind, or notes, and connectors by role, predicate, or notes. Click a result to select and frame it. Double click a named result to rename it.
- **Inspector:** see a live notation preview and connected elements. Add an attached attribute, key, direct subclass, specialization group, or component attribute with one click. New components automatically mark their parent attribute as composite.
- **Tidy layout:** arrange selected elements (two or more), or the whole diagram. Hierarchies are layered, relationships placed near their participating entities, and attributes placed around their owners; shapes avoid overlap. Layout is deterministic and can be undone. Use alignment/distribution for final adjustments.
- **Navigation:** toggle the interactive minimap, focus a selection, or click a model warning to frame the affected shape/connector. The notation guide explains Chen shapes, cardinality, EER constraints, categories, and shortcuts.

New diagrams and JSON imports are undoable, including the previous title, notation, viewport, and grid settings. Pending local saves are flushed when the app is hidden or closed. Weak entities connecting to identifying relationships default to total participation. JSON remains version 1 and existing diagrams remain compatible.

Model checks report invalid min–max bounds, mismatched participation, empty ratios/names, missing or incompatible connector endpoints, duplicate category sources, weak identification without total participation, and inheritance cycles. Inheritance and attribute ownership checks use iterative graph traversal so deep models avoid recursion limits. Warnings do not block editing or exporting.

## Shortcuts

| Shortcut                           | Action                                                        |
| ---------------------------------- | ------------------------------------------------------------- |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z       | Undo, redo                                                    |
| Ctrl/Cmd+C, V, D                   | Copy, paste, duplicate selected nodes and internal connectors |
| Ctrl/Cmd+A                         | Select all                                                    |
| Ctrl/Cmd+S                         | Save locally now                                              |
| Delete or Backspace                | Delete selection                                              |
| F                                  | Fit diagram in view                                           |
| Shift+F                            | Fit selected elements                                         |
| E / R / A / S / T                  | Entity / relationship / attribute / specialization / text     |
| Arrow keys / Shift+arrow           | Move selected elements 1 / 20 units (20 with grid snap)       |
| F2                                 | Rename a selected named element                               |
| ?                                  | Open the notation and shortcut guide                          |
| Escape                             | Cancel tool and clear selection                               |
| Drag on blank canvas               | Pan the canvas                                                |
| Shift+click / drag on blank canvas | Multi-select / marquee select                                 |

Use the context menu for node and canvas actions. Select multiple nodes for alignment and distribution controls in the inspector.

## Files and export

JSON export uses a versioned document with `version`, `title`, `nodes`, `edges`, `viewport`, and `settings`. Node and edge data hold the notation semantics. Selections, menus, and editor history are omitted. JSON import validates the structure and restores all modeled properties. Failed imports and exports show an in-app message.

SVG export builds a clean vector diagram with embedded Lexend font files, cached after the first export. PNG export rasterizes the same SVG at up to 2× resolution with a white background; large images are scaled down to stay within a 16,384-pixel side and 32-megapixel canvas budget. Both are cropped to diagram bounds with padding and omit the grid, handles, selections, and editor UI. Export filenames preserve Vietnamese and other Unicode letters. Connector labels follow the actual path, including orthogonal bends.

## Implementation

React, TypeScript, Vite, React Flow, Zustand, Lucide icons, and custom SVG geometry. React Flow provides canvas interactions; all diagram shapes and rendered connectors are custom. `src/model` owns semantic types, document parsing, starter data, and validation; `src/geometry` owns shape and connector geometry; `src/store` owns actions and undo history; `src/utils/export.ts` produces independent SVG and PNG artifacts.

## Current limitations

Tidy layout is a starting point: it avoids shape overlap but does not guarantee crossing-free connectors or optimal label spacing. The editor does not generate diagrams from SQL. Local storage is specific to the browser profile or desktop app, so export JSON to move diagrams between them or between devices. Undo history lasts for the current app session.
