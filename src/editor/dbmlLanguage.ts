import type * as Monaco from 'monaco-editor'

export const DBML_LANGUAGE_ID = 'dbml'

export function registerDbmlLanguage(monaco: typeof Monaco) {
  monaco.languages.register({ id: DBML_LANGUAGE_ID })

  monaco.languages.setMonarchTokensProvider(DBML_LANGUAGE_ID, {
    keywords: ['Table', 'TableGroup', 'Enum', 'Ref', 'Project', 'Note', 'indexes', 'as'],
    settings: ['pk', 'primary', 'key', 'not', 'null', 'unique', 'increment', 'default', 'ref', 'note'],
    types: [
      'int', 'integer', 'bigint', 'smallint', 'tinyint',
      'varchar', 'char', 'text', 'nvarchar', 'ntext',
      'boolean', 'bool',
      'date', 'datetime', 'timestamp', 'time',
      'float', 'double', 'decimal', 'numeric', 'real',
      'uuid', 'json', 'jsonb', 'xml',
      'serial', 'bigserial', 'smallserial',
      'blob', 'bytea', 'binary', 'varbinary',
    ],

    tokenizer: {
      root: [
        // Block comments
        [/\/\*/, 'comment', '@blockComment'],
        // Line comments
        [/\/\/.*$/, 'comment'],
        // Multi-line strings
        [/'''/, 'string', '@multiLineString'],
        // Strings
        [/'[^']*'/, 'string'],
        [/"[^"]*"/, 'string'],
        [/`[^`]*`/, 'string.backtick'],
        // Hex colors
        [/#[0-9a-fA-F]{3,6}\b/, 'number.hex'],
        // Numbers
        [/\d+(\.\d+)?/, 'number'],
        // Ref operators
        [/<>/, 'operator'],
        [/[<>\-]/, 'operator'],
        // Brackets
        [/[{}()\[\]]/, '@brackets'],
        // Identifiers and keywords
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@settings': 'variable',
            '@types': 'type',
            '@default': 'identifier',
          },
        }],
        // Colon, comma
        [/:/, 'delimiter'],
        [/,/, 'delimiter'],
      ],
      blockComment: [
        [/\*\//, 'comment', '@pop'],
        [/./, 'comment'],
      ],
      multiLineString: [
        [/'''/, 'string', '@pop'],
        [/./, 'string'],
      ],
    },
  })
}
