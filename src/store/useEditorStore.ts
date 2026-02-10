import { create } from 'zustand'
import type { ParseResult } from '../types'

export const DEFAULT_DBML = `// Data Vault 2.0 — conceptual + relational views
// Toggle "Conceptual" / "Relational" in the diagram panel

TableGroup hubs {
  Customer
  Card
}

TableGroup satellites {
  CustomerPII
  CardDetails
}

TableGroup links {
  CustomerCard
}

Table Customer {
  hk_customer binary [pk, note: 'hash key']
  load_date timestamp [not null]
  record_source varchar [not null]
  customer_id integer [not null]
}

Table Card {
  hk_card binary [pk, note: 'hash key']
  load_date timestamp [not null]
  record_source varchar [not null]
  card_number varchar [not null]
}

Table CustomerPII {
  hk_customer binary [pk]
  load_date timestamp [pk]
  hash_diff binary [not null]
  first_name varchar
  last_name varchar
  email varchar
}

Table CardDetails {
  hk_card binary [pk]
  load_date timestamp [pk]
  hash_diff binary [not null]
  card_type varchar
  expiry_date date
}

Table CustomerCard {
  hk_customer_card binary [pk, note: 'hash key']
  hk_customer binary [not null]
  hk_card binary [not null]
  load_date timestamp [not null]
  record_source varchar [not null]
}

Ref: CustomerPII.hk_customer > Customer.hk_customer
Ref: CardDetails.hk_card > Card.hk_card
Ref: CustomerCard.hk_customer > Customer.hk_customer
Ref: CustomerCard.hk_card > Card.hk_card
`

interface EditorState {
  dbml: string
  parseResult: ParseResult | null
  parseErrors: string[]
  setDbml: (dbml: string) => void
  setParseResult: (result: ParseResult | null) => void
  setParseErrors: (errors: string[]) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  dbml: DEFAULT_DBML,
  parseResult: null,
  parseErrors: [],
  setDbml: (dbml) => set({ dbml }),
  setParseResult: (parseResult) => set({ parseResult }),
  setParseErrors: (parseErrors) => set({ parseErrors }),
}))
