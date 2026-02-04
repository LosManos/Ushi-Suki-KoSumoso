# Kosumoso Manual

Kosumoso is a query tool designed for developers using Azure Cosmos. It focuses on keyboard accessibility, powerful data visualization, and what a developer needs (not a dba).

---

## Getting Started

### Connection
You can connect with Managed Identity or Connection String.
*   **Security**: Your connection strings are stored securely in your operating system's native keychain.
*   **ReadOnly**: For production data, it is recommended to use a Read-Only key for safety.

### Main Interface
*   **Sidebar (Left) (`Cmd + shift + E`)**: Navigate through your Databases and Containers.
*   **Query Editor (Top)**: Write and execute your SQL queries.
*   **Results View (Bottom)**: Inspect your data in various formats.
*   **Shorcuts**: Hover over any button or label to see the keyboard shortcut.

---

## Querying Data

### SQL Editor (`Cmd + E`)
The editor supports standard Cosmos DB SQL syntax with syntax colouring.
*   **Execute Query**: Press `Cmd + Enter` (Mac) or `Ctrl + Enter` (Windows/Linux).
*   **Execute Paragraph**: If you have multiple queries, Kosumoso will execute the specific block of text where your cursor is currently located.
*   **ID Lookup**: To quickly find a document by ID, use the "Get by ID".
*   **Query Helper Mode (`Cmd + Shift + H`)**: A toggleable mode that provides intellisense-like autocomplete for property names. Type `c.` to see a list of available properties from the discovered schema. Use `*` to quickly select all properties.
*   **Schema Discovery**: Use "Select property" to discover (from the first 100 documents) the properties for the current container. Write value and select "Append" to have the query written for you.

### Query History
Found in the sidebar, the history saves your successful queries.
*   **Select**: Clicking a history item will append it to your current query editor.
*   **Delete**: Remove old entries using the `X` button.

---

## Inspecting Results (`Cmd + T`)

Kosumoso provides three distinct ways to view your data:

### 1. Text View (`Cmd + T`)
A standard JSON representation of your results. It is optimized for quick copying:
*   **Alt + K**: Copy the **Key** of the current line.
*   **Alt + V**: Copy the **Value** of the current line (with quotes).
*   **Alt + R**: Copy the **Raw Value** (without quotes).
*   **Alt + B**: Copy **Both** (Key and Value).

### 2. Hierarchical View (`Cmd + Shift + T`)
An interactive tree structure for exploring complex JSON objects.
*   **Navigation**: Use arrow keys to navigate the tree. Or simplified VI keys.
*   **Expansion**: `Right` to expand a node, `Left` to collapse it.
*   **Fast Expansion**: Expanding a node while holding `Alt` will expand/collapse all children at that level.
*   **Property Isolation**: `Alt + W` on a selected element will filter the view to show only elements of the same kind (key). While active, you can right-click to **Copy All Isolated Values** as a JSON array. Press `Alt + W` again or `Esc` to clear.
*   **Follow Link**: `F` (or Right-click -> Follow Link) on a value to query for that value, even in another container (useful for foreign keys).
*   **Translations**: Assign human-readable labels to specific values (e.g., `1` -> `Active`). Labels appear in parentheses next to the value.

### 3. Template View (`Cmd + Alt + T`)
Transform your JSON results into custom text formats.
*   **Usage**: Use placeholders like `{id}` or `{profile.name}` in the template box.
*   **Escaping**: Use `{{` and `}}` for literal braces.
*   **Scenario**: Perfect for generating CSV lines, Bash commands, or human-readable reports from your data.

---

## Advanced Features

### Document Comparison
Select 2 to 5 documents from your results and click **Compare** (or `Cmd + Alt + C`).
*   **Line-by-Line**: Compares documents as raw text.
*   **Character Diff**: Shows exact character additions and removals.
*   **Semantic (JSON)**: Compares the logical structure of the JSON, ignoring key order.
*   **Sync Scroll**: Keeps all panes aligned while you scroll.
*   **Ignore Array Order**: (Semantic mode only) Compares arrays as sets, ignoring the sequence of elements.
*   **Age Indicator**: Shows which document is newer/older based on the `_ts` property.

### Command Palette (`Cmd + P`)
Quickly jump to any container in your account without using the sidebar. Just start typing the container or database name.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Cmd + Enter`** | Execute current query/paragraph |
| **`Cmd + P`** | Open Container Palette |
| **`Cmd + T`** | Switch to Text Results |
| **`Cmd + Shift + T`** | Switch to Hierarchical Results |
| **`Cmd + Alt + T`** | Switch to Template Results |
| **`Cmd + E`** | Focus Query Editor |
| **`Cmd + Shift + H`**| Toggle Query Helper Mode |
| **`Cmd + R`** | Focus Results View |
| **`Cmd + F`** | Find/Filter in Results |
| **`Cmd + S`** | Save Results to File |
| **`Cmd + Shift + S`**| Copy Results to Clipboard |
| **`Cmd + D`** | Change Connection / Log Out |
| **`Cmd + M`** | Focus Query Resize Handle |
| **`Cmd + Shift + M`**| Focus Sidebar Resize Handle |
| **`Alt + Enter`** | Open Context Menu |
| **`Alt + W`** | Focus Property Isolation |
| **`Cmd + 1-8`** | Switch to Query view 1-9 |
| **`Cmd + 9`** | Switch to last Query view |
| **`Cmd + Opt + I`** | Query for {clipboard} (quoted) |
| **`Cmd + Opt + Shift + I`** | Query for {clipboard} |
| **`Cmd + ,`** | Open main menu |

---

## Tips & Tricks
*   **Paragraph Execution**: You can keep a "scratchpad" of many queries in one tab and just move your cursor to the one you want to run.
*   **Deep Links**: Once you configure a "Follow Link" mapping, Kosumoso remembers it for that specific property path across your entire account.
*   **Performance**: Tab management allows you to keep different containers open simultaneously without losing your query state.
