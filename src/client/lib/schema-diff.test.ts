import { describe, expect, test } from 'bun:test'
import { diffSchemas } from './schema-diff'

describe('diffSchemas', () => {
  test('surfaces table, column, and foreign key changes between schemas', () => {
    const comparison = {
      tables: [
        {
          schema: 'dbo',
          name: 'Users',
          columns: [
            {
              name: 'Id',
              dataType: 'int',
              maxLength: null,
              numericPrecision: 10,
              numericScale: 0,
              isNullable: false,
              isPK: true,
              isFK: false,
              referencesTable: null,
              referencesColumn: null,
            },
            {
              name: 'Email',
              dataType: 'varchar',
              maxLength: 120,
              numericPrecision: null,
              numericScale: null,
              isNullable: true,
              isPK: false,
              isFK: false,
              referencesTable: null,
              referencesColumn: null,
            },
          ],
        },
        {
          schema: 'dbo',
          name: 'Roles',
          columns: [],
        },
      ],
      foreignKeys: [
        {
          parentTable: 'Users',
          parentColumn: 'RoleId',
          referencedTable: 'Roles',
          referencedColumn: 'Id',
        },
      ],
    }

    const current = {
      tables: [
        {
          schema: 'dbo',
          name: 'Users',
          columns: [
            {
              name: 'Id',
              dataType: 'bigint',
              maxLength: null,
              numericPrecision: 19,
              numericScale: 0,
              isNullable: false,
              isPK: true,
              isFK: false,
              referencesTable: null,
              referencesColumn: null,
            },
            {
              name: 'Email',
              dataType: 'varchar',
              maxLength: 255,
              numericPrecision: null,
              numericScale: null,
              isNullable: false,
              isPK: false,
              isFK: false,
              referencesTable: null,
              referencesColumn: null,
            },
            {
              name: 'RoleId',
              dataType: 'int',
              maxLength: null,
              numericPrecision: 10,
              numericScale: 0,
              isNullable: false,
              isPK: false,
              isFK: true,
              referencesTable: 'Roles',
              referencesColumn: 'Id',
            },
          ],
        },
        {
          schema: 'dbo',
          name: 'Permissions',
          columns: [],
        },
      ],
      foreignKeys: [],
    }

    const diff = diffSchemas(current, comparison)

    expect(diff.currentOnlyTables).toEqual(['dbo.Permissions'])
    expect(diff.comparisonOnlyTables).toEqual(['dbo.Roles'])
    expect(diff.currentOnlyColumns).toEqual([{ tableId: 'dbo.Users', columnName: 'RoleId' }])
    expect(diff.comparisonOnlyColumns).toEqual([])
    expect(diff.currentOnlyForeignKeys).toEqual([])
    expect(diff.comparisonOnlyForeignKeys).toEqual(['Users.RoleId -> Roles.Id'])
    expect(diff.changedColumns).toEqual([
      {
        tableId: 'dbo.Users',
        columnName: 'Email',
        changes: [
          'nullability NULL -> NOT NULL',
          'max length 120 -> 255',
        ],
      },
      {
        tableId: 'dbo.Users',
        columnName: 'Id',
        changes: [
          'type int -> bigint',
          'precision/scale 10,0 -> 19,0',
        ],
      },
    ])
  })
})
