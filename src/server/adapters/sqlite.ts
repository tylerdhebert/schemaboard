import { Database } from 'bun:sqlite'
import type { DbAdapter } from './types'
import type { SchemaData, SchemaTable, Column, ForeignKey } from '../../types'

export const sqliteAdapter: DbAdapter = {
  async testConnection(connectionString) {
    try {
      const db = new Database(connectionString, { readonly: true })
      db.close()
    } catch (err) {
      throw new Error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },

  async listSchemas(_connectionString) {
    return ['main']
  },

  async listTables(connectionString) {
    const db = new Database(connectionString, { readonly: true })
    try {
      return db
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        )
        .all()
        .map(r => `main.${r.name}`)
    } finally {
      db.close()
    }
  },

  async fetchSchema(connectionString, excludedSchemas, includedTables) {
    if (excludedSchemas?.includes('main')) return { tables: [], foreignKeys: [] }
    const db = new Database(connectionString, { readonly: true })
    try {
      let tableNames = db
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        )
        .all()

      if (includedTables?.length) {
        const included = new Set(includedTables)
        tableNames = tableNames.filter(({ name }) => included.has(`main.${name}`))
      }

      const tables: SchemaTable[] = []
      const foreignKeys: ForeignKey[] = []

      for (const { name: tableName } of tableNames) {
        // Table name comes from sqlite_master (not user input); double-quote escaping is safe.
        const safeName = tableName.replace(/"/g, '""')

        const colRows = db
          .query<{ cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number }, []>(
            `PRAGMA table_info("${safeName}")`
          )
          .all()

        const fkRows = db
          .query<{ id: number; seq: number; table: string; from: string; to: string }, []>(
            `PRAGMA foreign_key_list("${safeName}")`
          )
          .all()

        const fkByColumn = new Map(fkRows.map(fk => [fk.from, fk]))

        const columns: Column[] = colRows.map(row => {
          const fkRow = fkByColumn.get(row.name)
          return {
            name: row.name,
            dataType: (row.type || 'text').toLowerCase(),
            maxLength: null,
            numericPrecision: null,
            numericScale: null,
            isNullable: row.notnull === 0 && row.pk === 0,
            isPK: row.pk > 0,
            isFK: !!fkRow,
            referencesTable: fkRow?.table ?? null,
            referencesColumn: fkRow?.to ?? null,
          }
        })

        tables.push({ schema: 'main', name: tableName, columns })

        for (const fkRow of fkRows) {
          foreignKeys.push({
            parentTable: tableName,
            parentColumn: fkRow.from,
            referencedTable: fkRow.table,
            referencedColumn: fkRow.to,
          })
        }
      }

      return { tables, foreignKeys }
    } finally {
      db.close()
    }
  },
}
