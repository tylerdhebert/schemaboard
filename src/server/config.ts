import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { AppConfig } from '../types'

export const CONFIG_PATH = process.env.SCHEMABOARD_CONFIG_PATH ?? './schemaboard.config.json'

const DEFAULTS: AppConfig = { connections: [], groups: [] }

export function readConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULTS }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as AppConfig
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}
