# schemaboard

> A local schema workbench for loading a database, arranging it into a readable map, saving named views, comparing versions, and exporting clean context when you need to explain the model to someone else.

## What This App Is

schemaboard is built around one simple idea: a schema is easier to understand when you can move between structure, organization, and explanation without leaving the same screen.

The app gives you three working surfaces at once:

| Surface | What it is for |
| --- | --- |
| Sidebar | Search, grouping, selection, visibility, and fast navigation |
| Canvas | Spatial layout, relationship browsing, manual arrangement, and board-level tools |
| Context panel | Copy-ready schema output for the current selection |

Around that core, it adds saved connections, workspaces, snapshots, and schema diffing, so the board can be more than a one-off diagram.

## Everything A User Can Do

### Sources And Modes

- Switch between live mode and demo mode.
- Connect to SQL Server, Postgres, or SQLite.
- Save named connections.
- Edit existing connections.
- Remove connections.
- Test a connection before saving it.
- Exclude specific schemas from a connection.
- Limit a connection to a chosen subset of tables.
- Clear the included-table filter and load everything again.
- Start a connection with all tables hidden on first load.
- Pick the active connection from the header.
- Refresh the active schema on demand.

### Canvas And Board Controls

- View tables as cards, including schema name, columns, PK/FK badges, and relationship lines.
- Pan and zoom the board with React Flow's built-in interactions.
- Use the minimap to pan and zoom from a bird's-eye view.
- Click a table on the canvas to select or deselect it.
- Drag a table to pin it in a manual position.
- Right-drag on empty canvas space to marquee-select tables.
- Open the gear menu to reach board tools.
- Recalc the layout, which clears manual table positions and reruns the current layout algorithm.
- Switch between `Dagre`, `Force`, and `ELK`.
- Toggle between full table view and headers-only view.
- Open a table picker to choose exactly which tables stay visible on the board.
- See relationship lines between tables, including crow's-foot style cardinality markers on normal table-to-table edges.

### Sidebar Navigation And Organization

- Search tables by name.
- Search columns by name.
- Filter the sidebar list while also highlighting matches on the canvas.
- Expand or collapse groups one at a time.
- Expand or collapse all groups at once.
- Create a new group from the sidebar.
- Rename a group.
- Recolor a group.
- Delete a group.
- Hide or show an entire group from the board.
- Select all tables in a group with one click.
- Zoom the board to a group.
- Edit a group from its inline action or context menu.
- Drag to reorder groups.
- Drag to reorder tables inside a group.
- Drag to reorder ungrouped tables in the sidebar.
- Show all hidden tables again with one action.

### Table And Selection Actions

- Select tables from the canvas.
- Select tables from the sidebar.
- Shift-click in the sidebar to select a range.
- Clear the current selection.
- Zoom to a single table.
- Zoom to the current selection.
- Hide a single table.
- Hide the current selection.
- Show a hidden table again.
- Open a table context menu for quick actions.
- Create a new group from one table.
- Create a new group from the current selection.
- Add one table to an existing group.
- Add a selection to an existing group.
- Remove a table from a group.
- Copy selection context straight from the selection bar or sidebar card.

### Context Export

- Generate context from the currently selected tables.
- Switch between `Condensed` and `DDL` output.
- Preview the export before copying it.
- Edit the generated text inline.
- Save an edited version of the current export while you work.
- Reset custom edits and go back to the generated output.
- See an approximate token count.
- Copy the final text to the clipboard.

The export is selection-driven. If nothing is selected, the panel stays empty. In condensed mode, the output reads like a compact schema summary. In DDL mode, it reads like `CREATE TABLE` statements. Foreign-key relationships are included for selected tables.

### Workspaces

- Save the current board state as a named workspace.
- Update the loaded workspace in place.
- Save the current state as a new workspace.
- Open the workspace manager.
- Load a saved workspace.
- Delete a saved workspace.

A workspace captures the working view, not just the source name. That includes selected tables, hidden tables, hidden groups, export format, chosen layout algorithm, compact-node mode, and manual table positions.

### Schema Diff And Snapshots

- Open the schema diff tool from the header.
- Compare the active source against another live connection.
- Capture the current schema as a named snapshot.
- Compare the active source against a saved snapshot later.
- Delete snapshots you no longer need.
- Switch between a condensed summary view and a detailed view.
- Filter diff results by text.
- Hide or show empty buckets.
- Focus the result set on all drift, current-only drift, target-only drift, or changed columns.
- Review summary metrics for table drift, column drift, foreign-key drift, and total deltas.

This part of the app is especially useful when a schema is moving under your feet and you want to answer, quickly, what changed and where the breakage might be hiding.

## The Layout Algorithms

All three layout options solve the same problem, but they do it with very different personalities.

| Layout | Best at | What makes it feel different |
| --- | --- | --- |
| `Dagre` | Clear directional structure | Layered, left-to-right, stable, and easy to scan |
| `Force` | Dense relationship webs | Organic spacing, looser clusters, and a more exploratory feel |
| `ELK` | Busy graphs that need discipline | Layered like Dagre, but more deliberate about spacing and edge-crossing cleanup |

### Dagre

`Dagre` is the clean, dependable default.

It treats the schema like a directed graph and places tables in layers from left to right. If your schema has obvious dependency chains, parent-child flows, or a shape that resembles a pipeline, Dagre usually makes the board readable very quickly.

Why it stands out:

- It is predictable.
- It tends to produce layouts that are easy to learn and revisit.
- It works well when you want a tidy "read it from left to right" diagram.

Use Dagre when you want the fastest path to a sensible board.

### Force

`Force` behaves less like a diagrammer and more like a physical system.

Tables repel each other, relationships pull related tables together, and collision rules stop cards from piling on top of each other. The result is a board that feels more organic and less rigid than a layered layout.

Why it stands out:

- It spreads dense clusters apart.
- It helps surface hubs and neighborhoods in a tangled schema.
- It is useful when strict layering makes the board feel cramped or artificial.

Use Force when you want to explore the shape of the schema rather than present it as a strict hierarchy.

### ELK

`ELK` is the most structured option when the graph starts getting busy.

Like Dagre, it is layered and directional. The difference is that ELK puts more effort into placement strategy and crossing reduction, which can make larger or noisier schemas feel calmer.

Why it stands out:

- It often handles crowded graphs more gracefully than a simpler layered pass.
- It is good at keeping a strong directional flow without making the board feel too compressed.
- It is a strong choice when Dagre is close, but still feels a little too rough around the edges.

Use ELK when you want a disciplined, presentation-friendly layout for a more complicated schema.

## A Few Practical Notes

- Manual dragging wins over the auto-layout until you recalc or switch layouts.
- Hidden groups and hidden tables affect what gets laid out.
- Search affects both the sidebar and the canvas, so it doubles as a navigation tool.
- The app is local-first in spirit: connections, groups, workspaces, and snapshots are meant to support day-to-day schema work, not just a one-time import.

## In One Sentence

schemaboard is a place to load a schema, shape it into something readable, save the view that matters, compare it against another moment in time, and walk away with copy-ready context instead of a mess.
