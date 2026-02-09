import { create } from 'zustand'
import type { ParseResult } from '../types'

export const DEFAULT_DBML = `// Sample DBML schema
Table users {
  id integer [pk, increment]
  username varchar [not null, unique]
  email varchar [not null, unique]
  created_at timestamp [default: \`now()\`]
  role user_role [not null]
}

Table posts {
  id integer [pk, increment]
  title varchar [not null]
  body text
  status post_status
  user_id integer [not null]
  created_at timestamp [default: \`now()\`]
}

Table comments {
  id integer [pk, increment]
  body text [not null]
  post_id integer [not null]
  user_id integer [not null]
  created_at timestamp [default: \`now()\`]
}

Enum user_role {
  admin
  editor
  viewer
}

Enum post_status {
  draft
  published
  archived
}

Ref: posts.user_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id
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
