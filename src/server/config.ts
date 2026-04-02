import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { AppConfig } from '../types'

export const CONFIG_PATH = './schemaboard.config.json'

const DEFAULTS: AppConfig = { connections: [], groups: [] }

function resolvedPath(): string {
  return process.env.SCHEMABOARD_CONFIG_PATH ?? CONFIG_PATH
}

export function readConfig(): AppConfig {
  const path = resolvedPath()
  if (!existsSync(path)) return { ...DEFAULTS }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as AppConfig
  } catch (err) {
    if (err instanceof SyntaxError) return { ...DEFAULTS }
    throw err
  }
}

export function writeConfig(config: AppConfig): void {
  writeFileSync(resolvedPath(), JSON.stringify(config, null, 2), 'utf-8')
}
