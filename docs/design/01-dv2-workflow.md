# Data Vault 2.0 Design Workflow Narrative
## From Empty Canvas to Production DDL in XineMap

---

## Phase 1: Project Kickoff and Source Analysis

### What I am doing

I have just been assigned a new data integration project. My source systems are, say, a CRM (Salesforce), an ERP (SAP), and a web analytics platform. Before I touch the modelling tool, I need to understand:

- What business entities exist across these sources (customers, orders, products, invoices)
- What the natural business keys are in each system
- What the grain of each source table is
- Which sources overlap (e.g., "customer" appears in all three systems)

My first deliverable is a source-to-target inventory: which source fields map to which Data Vault constructs. But before that, I need a place to capture notes and context.

### What I need from the tool

**Right now**: I open XineMap, click "New", and I am staring at the default DBML example. Good -- I can start typing. But I have no way to capture project-level metadata. I want to record somewhere:

- Project name: "Acme Analytics DW"
- Source systems: CRM, ERP, Web Analytics
- Data architect: me
- Date started

**What is missing**:

1. **Project metadata panel or DBML header convention**: DBML has a `Project` block (`Project acme_dw { database_type: 'Snowflake' Note: '...' }`). The tool should parse this and display project-level information in the toolbar or a sidebar. Currently the `parseDbml.ts` parser ignores the `Project` block entirely -- it only processes schemas, tables, refs, and enums.

2. **Source system documentation**: I need a way to annotate where data comes from before I even start modelling hubs. DBML `Note` blocks are supported in conceptual view (`stickyNotes` in `parseDbml.ts` line 100-105), which is a start. But I need these notes to be more structured -- possibly a convention like source system cards that appear in both views.

3. **No import capability**: In a real project, I would want to paste in a DDL from the source system and have the tool reverse-engineer it into DBML. The `@dbml/core` library supports `importer.import(ddl, 'postgres')`. This would save enormous time rather than manually typing every source table.

---

## Phase 2: Identifying Business Keys and Hubs

### What I am doing

This is the most critical modelling decision. I am identifying the core business entities -- the "nouns" of the business. For each, I need the natural business key.

Examples:
- **Customer**: `customer_id` from CRM, `kunnr` from SAP, `visitor_id` from web analytics -- all represent the same concept
- **Product**: `product_sku` from ERP
- **Order**: `order_number` from ERP
- **Invoice**: `invoice_id` from ERP

A hub is defined by its business key. The hub table itself contains:
- `hk_<entity>` (hash key -- hash of the business key, primary key)
- `load_date` (when the record was first loaded)
- `record_source` (which system first provided this record)
- One or more business key columns (the natural key)

### What a hub looks like conceptually vs relationally

**Conceptual**: A golden rounded rectangle labeled "Customer". That is it. No columns visible. The shape and color tell me "this is a hub". This is what I show to business stakeholders.

**Relational**: A full table node showing:
```
Customer
---------
hk_customer    binary   PK
load_date      timestamp
record_source  varchar
customer_id    integer
```

The current tool handles both views. The conceptual `HubNode` renders as a golden rounded rect (`#fbbf24` background), and the relational `TableNode` shows columns with PK/FK badges. The `TableGroup hubs { Customer }` convention correctly maps to `hubNode` in the conceptual view.

### What is painful or missing

1. **No hub-specific validation**: When I create a table and put it in `TableGroup hubs`, the tool does not verify that it has the standard hub columns (`hk_*`, `load_date`, `record_source`, at least one business key). A hub without `load_date` is malformed. The tool should warn me.

2. **No scaffolding or templates**: When I decide "I need a hub called Product", I want to type `hub Product { product_sku varchar }` and have the tool auto-generate the boilerplate (`hk_product`, `load_date`, `record_source`). Currently I have to manually write every column. This is tedious and error-prone for large models with 30+ hubs.

3. **Naming convention enforcement**: In DV2.0, hash keys follow a convention: `hk_<entity_name>`. The tool does not know about this. It would be valuable to have optional linting: "Hub Customer has no column starting with `hk_`".

4. **No business key highlighting**: In the relational view, business key columns (e.g., `customer_id` in the Customer hub) are not visually distinguished from the hash key or metadata columns. The PK badge marks the hash key, but there is no "BK" badge. This distinction matters -- it is the most important column in the hub.

5. **Conceptual node does not show the business key**: When I hover over or click a hub node in conceptual view, I want to see what the business key is, without switching to relational view. Currently the conceptual `HubNode` only renders `data.label` (the table name). No tooltip, no popover, no detail panel.

---

## Phase 3: Identifying Relationships and Links

### What I am doing

Links capture the relationships between business entities. I look at the source data and ask: "What many-to-many or many-to-one relationships exist?"

Examples:
- **CustomerOrder**: Links Customer and Order (a customer places many orders)
- **OrderProduct**: Links Order and Product (an order contains many products -- this is also a link with possible quantity as a dependent child satellite)
- **CustomerAddress**: Could be a standard link or a hierarchical link if addresses are shared

### Types of links

1. **Standard link**: Connects two or more hubs. Contains hash keys of all participating hubs plus its own hash key (`hk_customer_order`), `load_date`, `record_source`.
2. **Same-as link**: Special link connecting a hub to itself, resolving business key collisions across source systems (e.g., CRM customer_id 123 is the same as ERP kunnr 456). Contains `hk_same_as_customer`, `hk_customer_master`, `hk_customer_duplicate`.
3. **Hierarchical link**: Connects a hub to itself for parent-child relationships (org hierarchies, BOM structures). Contains two hash keys referencing the same hub.
4. **Non-historized link (link without satellites)**: A link where the relationship is immutable once established.
5. **Effectivity satellite on a link**: Tracks when a relationship is active/inactive.

### How links connect to hubs

In the DBML, this is expressed via `Ref` statements. The current tool handles this: `Ref: CustomerCard.hk_customer > Customer.hk_customer` creates an edge from the link to the hub. In conceptual view this renders as a smoothstep line from the golden diamond (link) to the golden rounded rect (hub).

### What is painful or missing

1. **Link node does not show participating hubs**: In conceptual view, I see a diamond labeled "CustomerCard" with lines going to Customer and Card. But when the model gets large (20+ entities), it is hard to trace which hubs a link connects. The link diamond should list the participating hub names inside it or show them on hover.

2. **No link type differentiation**: The tool treats all links the same. Same-as links and hierarchical links should have distinct visual indicators -- different border styles, different labels, or a small icon. Currently the conceptual `LinkNode` is always a plain golden diamond.

3. **No multi-hub link support visualization**: A link can connect 3 or more hubs (e.g., a Transaction link connecting Customer, Product, and Store). The diamond shape is fine, but the layout engine does not handle 3+ edges gracefully -- it often overlaps edges. Dagre handles this, but `ranksep` and `nodesep` values (currently 80 and 50 in `layoutEngine.ts`) may need to be larger.

4. **Self-referencing links**: Hierarchical links need two references to the same hub. DBML can express this, but the diagram rendering may not handle two edges between the same two nodes cleanly.

5. **No driving key indication**: In a link with 3+ hubs, one hub is often the "driving key" (determines the grain). There is no way to annotate this visually.

---

## Phase 4: Identifying Descriptive Data and Satellites

### What I am doing

Satellites hold the context -- the descriptive attributes that change over time. For every hub and link, I ask: "What data describes this entity, and how does it change?"

### How I decide what goes into which satellite

The decision factors for satellite splits are:

1. **Rate of change**: Columns that change daily (e.g., account balance) should not be in the same satellite as columns that change yearly (e.g., customer name). Splitting prevents unnecessary re-hashing and storage bloat.
2. **Source system**: Data from CRM about a customer goes in `sat_customer_crm`, data from ERP goes in `sat_customer_erp`. This is the most common split.
3. **Business context / subject area**: PII columns (name, email, SSN) go in a separate satellite from non-PII columns for security and access control.
4. **Sensitivity / classification**: Regulatory or restricted data in its own satellite.

### How satellites attach

- **Hub satellites**: FK to the hub's hash key. The satellite's PK is composite: `(hk_<hub>, load_date)`.
- **Link satellites**: FK to the link's hash key. PK is `(hk_<link>, load_date)`.
- **Effectivity satellites**: Attached to links, tracking start/end dates of the relationship validity.
- **Multi-active satellites**: Satellites where multiple records per hash key per load date are valid (e.g., phone numbers). PK includes an additional key column.

### What a satellite always contains

- `hk_<parent>` (FK to hub or link hash key) -- part of PK
- `load_date` (timestamp) -- part of PK
- `hash_diff` (hash of all descriptive columns -- used for change detection)
- `record_source` (where this version of the data came from)
- Descriptive columns

The current default DBML example shows this pattern correctly (e.g., `CustomerPII` with `hk_customer`, `load_date`, `hash_diff`, then descriptive columns).

### What is painful or missing

1. **No satellite-to-parent validation**: The tool does not check that a satellite in `TableGroup satellites` actually has a ref to a hub or link. An orphan satellite is a bug in the model.

2. **Satellite type is not captured**: The tool does not distinguish between regular satellites, effectivity satellites, multi-active satellites, and status-tracking satellites. Each has different column patterns. At minimum, the tool should recognize effectivity satellites (they have `start_date`/`end_date` columns and attach to links).

3. **No hash_diff column awareness**: `hash_diff` is critical -- it determines what columns are tracked for change detection. The tool should know that this column exists and ideally know which columns are included in the hash. This matters for DDL generation downstream.

4. **Satellite count indicator on conceptual view**: When a hub has 5 satellites, the conceptual view becomes cluttered with green circles. I want the option to collapse satellites into a count badge on the hub node: "Customer (5 sats)" and expand on click.

5. **No satellite split guidance**: The tool cannot suggest satellite splits. This is advanced, but even a simple heuristic ("these columns are from different `record_source` values in the DBML notes") would help.

---

## Phase 5: Adding Context and Notes

### What I am doing

As I model, I accumulate design decisions that need to be recorded:

- "We chose to split CustomerPII from CustomerDetails because PII is subject to GDPR right-to-erasure"
- "OrderProduct link uses product_sku + order_number as the composite business key"
- "Source system X has soft deletes, tracked via is_deleted flag in sat_customer_crm"
- "Hash algorithm: MD5 for dev, SHA-256 for production"
- "Load pattern: full daily extract from CRM, CDC from ERP"

### How I annotate the model

DBML supports:
- Table-level `Note`: `Table Customer { Note: 'Core customer hub - BK is customer_id from CRM' }`
- Column-level `note`: `customer_id integer [not null, note: 'Natural BK from Salesforce']`
- Standalone `Note` blocks: `Note design_decisions { 'We split satellites by source system...' }`

### What is painful or missing

1. **Table notes are parsed but not displayed**: `parseDbml.ts` extracts `table.note` (line 40), and `TableInfo` has a `note` field, but `TableNode.tsx` does not render it. There is no tooltip, no expandable section, no icon indicating a note exists.

2. **Column notes are parsed but barely visible**: `ColumnInfo` has a `note` field, it is extracted from DBML (line 37), but `TableNode.tsx` does not display column notes at all. These are critical -- they document business key origins, transformation logic, etc.

3. **Standalone notes only appear in conceptual view**: The `NoteNode` component exists but is only rendered in `parseResultToConceptualFlow`. In relational view, `parseResultToFlow` does not create nodes for `stickyNotes`. Design decision notes should be visible in both views.

4. **No note linking**: I cannot attach a sticky note to a specific entity visually. The note just floats in the layout. I want to draw a dashed line from a note to the relevant hub/link/satellite.

5. **No note search**: In a large model with 20 notes, I cannot search for "GDPR" to find the relevant design decision.

---

## Phase 6: Iterating the Conceptual Model

### What I am doing

The conceptual model is never right the first time. I iterate:

- Rename entities as the business language clarifies ("CustomerAccount" becomes just "Customer")
- Split a hub that was too coarse ("Product" splits into "Product" and "ProductVariant")
- Merge links that are redundant
- Reorganize satellite assignments
- Add links I missed when I discover a new relationship in the data

I also show this model to business stakeholders. They understand golden rounded rects (business entities) and diamonds (relationships). They do NOT understand hash keys, load dates, or DDL.

### What I need from the tool

**For my iteration work**:
- Quick rename: Change "CustomerAccount" to "Customer" in the DBML and see the diagram update instantly. The current tool does this well -- type in the editor, the diagram re-renders via `useParseEffect`.
- Split: Duplicate a hub definition, rename, move some refs. All manual in the DBML editor.
- Undo/redo: If I make a bad change, I need to revert. Monaco has built-in undo, so this works.

**For stakeholder presentations**:
- The conceptual view is exactly right for this. Clean shapes, no technical clutter.
- PNG export works via `exportPng.ts`.

### What is painful or missing

1. **No zoom-to-fit on specific entity**: If I am discussing "Customer" with a stakeholder, I want to click a hub name in a sidebar or search box and have the diagram center on that node. Currently the only navigation is manual pan/zoom and the fitView on initial render.

2. **No entity search or filter**: In a model with 80 tables (common in production DV2.0), finding a specific hub in the diagram is painful. I need a search box that highlights or filters the diagram.

3. **No grouping or clustering**: Large models need visual grouping -- "these 5 hubs and their satellites relate to the Order domain". DBML `TableGroup` is used for DV2.0 type classification (hub/sat/link), so I cannot also use it for domain grouping. I need a second grouping mechanism.

4. **No minimap**: React Flow supports a `<MiniMap />` component. For large models, this is essential for orientation. Currently not included in `DiagramPanel.tsx`.

5. **Layout breaks with scale**: Dagre with `ranksep: 80, nodesep: 50` works for 5-10 entities. At 40+ entities, the auto-layout produces overlapping labels or too-spread-out graphs. I need layout tuning controls or multiple layout algorithms (e.g., force-directed for conceptual, hierarchical for relational).

6. **No presentation mode**: I want a full-screen, chrome-free view for stakeholder presentations. Hide the editor panel, hide the toolbar, just show the diagram with a clean background. Currently I can resize the Allotment pane, but I cannot hide the editor entirely.

---

## Phase 7: Fleshing Out the Relational Model

### What I am doing

Once the conceptual model is stable, I switch to relational view and add every column. This is where the real engineering happens.

### Column patterns by entity type

**Hub columns** (always, in this order):
| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `hk_<hub_name>` | `binary(16)` or `varchar(32)` | PK | MD5 or SHA-256 hash of the business key |
| `load_date` | `timestamp_ntz` | NOT NULL | First time this BK was seen |
| `record_source` | `varchar` | NOT NULL | System that first provided this BK |
| `<business_key_1>` | varies | NOT NULL | The natural key |
| `<business_key_2>` | varies | NOT NULL | Only if composite BK |

**Link columns** (always):
| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `hk_<link_name>` | `binary(16)` | PK | Hash of all participating hub BKs |
| `hk_<hub_1>` | `binary(16)` | NOT NULL, FK | Hash key of first hub |
| `hk_<hub_2>` | `binary(16)` | NOT NULL, FK | Hash key of second hub |
| `load_date` | `timestamp_ntz` | NOT NULL | First time this relationship was seen |
| `record_source` | `varchar` | NOT NULL | Source system |

**Satellite columns** (always):
| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `hk_<parent>` | `binary(16)` | PK, FK | Hash key of parent hub or link |
| `load_date` | `timestamp_ntz` | PK | When this version was loaded |
| `load_end_date` | `timestamp_ntz` | NULL | When this version was superseded (ghost record pattern) |
| `hash_diff` | `binary(16)` | NOT NULL | Hash of all descriptive columns |
| `record_source` | `varchar` | NOT NULL | Source system |
| `<attribute_1>` | varies | varies | Descriptive data |
| `<attribute_n>` | varies | varies | Descriptive data |

### Naming conventions

- Hubs: `hub_<entity>` or just `<Entity>` with group membership
- Satellites: `sat_<parent>_<qualifier>` (e.g., `sat_customer_crm`, `sat_customer_pii`)
- Links: `lnk_<hub1>_<hub2>` or `link_<hub1>_<hub2>`
- Hash keys: `hk_<entity>`
- All lowercase with underscores for Snowflake

### What is painful or missing

1. **No Snowflake-specific types**: The DBML type system is generic. Snowflake uses `TIMESTAMP_NTZ`, `VARIANT`, `NUMBER(38,0)`. The DBML parser accepts any string as a type, which is fine, but the SQL export via `@dbml/core` exporter may not produce valid Snowflake DDL. The `exportSql.ts` supports postgres, mysql, mssql, oracle -- **but not Snowflake**. This is a critical gap for a DV2.0 tool since Snowflake is the most common modern DV2.0 target.

2. **No column ordering control**: In Data Vault, column ordering has conventions (hash key first, then load_date, then record_source, then business keys/descriptive columns). The DBML editor preserves declaration order, but if I need to reorder I have to cut/paste lines manually. A "sort columns by DV2.0 convention" button would save time.

3. **No type templates**: I want to define once that all hash keys are `binary(16)`, all load dates are `timestamp_ntz`, and have the tool apply this consistently. Currently I must type `binary` every time and hope I am consistent.

4. **No cross-reference validation**: If `sat_customer_crm.hk_customer` references `hub_customer.hk_customer`, the types must match. The tool does not check this. Type mismatches cause Snowflake DDL failures.

5. **No column count/stats**: In relational view, I want to see at a glance how many columns each table has. Wide satellites (30+ columns) are a design smell suggesting the satellite should be split.

---

## Phase 8: Validation and Review

### What I am doing

Before I call the model "done", I validate it systematically:

1. **Structural checks**:
   - Every hub has at least one satellite (a hub with no satellites has no descriptive data -- likely a modelling error)
   - Every satellite has a ref to exactly one hub or link
   - Every link references at least two hubs
   - No orphan tables (tables not in any TableGroup)
   - No circular references in the link structure

2. **Column-level checks**:
   - Every hub has `hk_*`, `load_date`, `record_source`, and at least one business key
   - Every satellite has `hk_*`, `load_date`, `hash_diff`
   - Every link has `hk_*` for itself and FK `hk_*` for each participating hub
   - PK constraints are set correctly (hub: single PK on hash key; satellite: composite PK on hash key + load_date; link: single PK on link hash key)
   - All hash key types are consistent across the model

3. **Naming convention checks**:
   - Hub hash keys match the entity name: `hk_customer` in table `Customer`
   - Satellite names include the parent entity name
   - Link names reflect the participating hubs

4. **Business logic checks**:
   - Are there business keys that appear in multiple hubs? (Possible same-as link needed)
   - Are there hubs with no links? (Isolated entities -- might be correct, but worth flagging)

### How I review with the team

- Share the PNG export of the conceptual view with business analysts
- Walk through the relational view table-by-table with the data engineering team
- Review the DDL with the DBA

### What is painful or missing

1. **No validation engine at all**: This is the single biggest gap. The tool has zero validation logic. It parses DBML and renders it, but never checks whether the model follows DV2.0 conventions. A validation panel showing warnings and errors (similar to a linter) is essential.

2. **No model statistics**: How many hubs, links, satellites? What is the hub-to-satellite ratio? How many links connect 3+ hubs? These aggregate metrics help me spot structural issues.

3. **No diff/changelog**: When I make changes during review, there is no way to see what changed since the last save. A diff view between the current DBML and the last saved version would be valuable.

4. **No collaborative review**: The tool is single-user (localStorage). For team review, I can only export PNG or share the DBML text. Real collaboration needs shared state -- this is a larger product decision, but at minimum, DBML file import/export (not just localStorage) would help.

5. **No annotation for review feedback**: If a reviewer says "split this satellite", I want to mark that entity with a review comment. DBML notes can serve this purpose, but a dedicated review/comment layer would be cleaner.

---

## Phase 9: Deployment to Snowflake

### What I am doing

I generate DDL and deploy to Snowflake, accounting for:

- Schema organization: `RAW_VAULT.hub_customer`, `RAW_VAULT.sat_customer_crm`, `RAW_VAULT.lnk_customer_order`
- Snowflake-specific syntax: `CREATE TABLE IF NOT EXISTS`, `TRANSIENT TABLE` for staging, `CLUSTER BY` for hash keys
- Hash function selection: `MD5()` for dev/perf, `SHA2()` for production
- Stream and task setup for CDC loading
- Zero-copy cloning for dev/test environments

### DDL generation considerations

For a hub:
```sql
CREATE TABLE IF NOT EXISTS raw_vault.hub_customer (
    hk_customer    BINARY(16)     NOT NULL,
    load_date      TIMESTAMP_NTZ  NOT NULL,
    record_source  VARCHAR(100)   NOT NULL,
    customer_id    NUMBER(38,0)   NOT NULL,
    CONSTRAINT pk_hub_customer PRIMARY KEY (hk_customer)
)
CLUSTER BY (hk_customer);
```

For a satellite:
```sql
CREATE TABLE IF NOT EXISTS raw_vault.sat_customer_crm (
    hk_customer    BINARY(16)     NOT NULL,
    load_date      TIMESTAMP_NTZ  NOT NULL,
    load_end_date  TIMESTAMP_NTZ,
    hash_diff      BINARY(16)     NOT NULL,
    record_source  VARCHAR(100)   NOT NULL,
    first_name     VARCHAR(100),
    last_name      VARCHAR(100),
    CONSTRAINT pk_sat_customer_crm PRIMARY KEY (hk_customer, load_date),
    CONSTRAINT fk_sat_customer_crm FOREIGN KEY (hk_customer)
        REFERENCES raw_vault.hub_customer (hk_customer)
)
CLUSTER BY (hk_customer, load_date);
```

### What is painful or missing

1. **No Snowflake dialect**: This is the most critical missing feature. `exportSql.ts` delegates to `@dbml/core`'s exporter, which supports postgres, mysql, mssql, oracle. Not Snowflake. For a DV2.0 tool, this is like building a car without an engine. I need either:
   - A custom Snowflake DDL generator that understands DV2.0 conventions (preferred)
   - Or at minimum, a Snowflake dialect in the `@dbml/core` exporter (may not be available)

2. **No CLUSTER BY support**: Snowflake clustering keys are critical for query performance on large Data Vault tables. The DDL generator needs to emit `CLUSTER BY (hk_*)` on hubs and links, and `CLUSTER BY (hk_*, load_date)` on satellites.

3. **No TRANSIENT table support**: Staging tables in Snowflake should be `TRANSIENT` (no Fail-safe = lower storage cost). The tool needs a way to mark certain tables as transient.

4. **No schema generation**: Snowflake DDL typically needs `CREATE SCHEMA IF NOT EXISTS raw_vault;` before the table DDL. The tool should generate schema creation statements.

5. **No deployment ordering**: DDL must be generated in dependency order -- hubs first, then links (which reference hubs), then satellites (which reference hubs or links). The current generic export does not guarantee this ordering.

6. **No loading template generation**: Beyond DDL, DV2.0 needs loading procedures/tasks. This is probably out of scope for a diagramming tool, but generating skeleton `MERGE INTO` statements for each satellite would be tremendously useful.

---

## Summary of Feature Priorities

Ranked by impact on a DV2.0 practitioner's daily work:

**Must-have (blocks productive use)**:
1. Snowflake DDL export dialect
2. DV2.0 model validation engine (structural + column-level checks)
3. Table and column note display in relational view
4. Entity search / find in diagram
5. Note display in relational view (not just conceptual)

**High value (significant productivity gains)**:
6. DV2.0 scaffolding/templates (auto-generate hub/sat/link boilerplate)
7. Hub/link/satellite column convention linting
8. Minimap for large models
9. DBML file import/export (not just localStorage)
10. Model statistics panel (entity counts, hub-to-sat ratios)

**Nice-to-have (polish and delight)**:
11. Source DDL import (reverse-engineer source system DDL into DBML)
12. Satellite collapse/expand in conceptual view
13. Presentation mode (hide editor, full-screen diagram)
14. Link type differentiation (same-as, hierarchical visual indicators)
15. Layout algorithm options / tuning controls
16. Deployment-ordered DDL with schema creation
