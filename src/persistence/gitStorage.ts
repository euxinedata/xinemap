import { Buffer } from 'buffer'
;(globalThis as unknown as Record<string, unknown>).Buffer = Buffer

import git from 'isomorphic-git'
import LightningFS from '@isomorphic-git/lightning-fs'
import type { SavedProject, CommitInfo, SourceConfig } from '../types'

const lfs = new LightningFS('dglml')
const fs = lfs
const pfs = lfs.promises

const PROJECTS_DIR = '/projects'
const AUTHOR = { name: 'DGLML', email: 'dglml@local' }

async function ensureDir(path: string): Promise<void> {
  try {
    await pfs.stat(path)
  } catch {
    await pfs.mkdir(path)
  }
}

async function ensureProjectsDir(): Promise<void> {
  await ensureDir(PROJECTS_DIR)
}

function projectDir(id: string): string {
  return `${PROJECTS_DIR}/${id}`
}

export async function initRepo(id: string): Promise<void> {
  const dir = projectDir(id)
  await ensureDir(dir)
  await git.init({ fs, dir })
}

export async function listProjects(): Promise<SavedProject[]> {
  await ensureProjectsDir()
  let entries: string[]
  try {
    entries = await pfs.readdir(PROJECTS_DIR)
  } catch {
    return []
  }

  const projects: SavedProject[] = []
  for (const id of entries) {
    const dir = projectDir(id)
    try {
      const meta = await pfs.readFile(`${dir}/project.json`, 'utf8') as string
      const { name } = JSON.parse(meta)
      const dbml = await pfs.readFile(`${dir}/model.dbml`, 'utf8') as string
      const stat = await pfs.stat(`${dir}/model.dbml`)
      projects.push({ id, name, dbml, updatedAt: stat.mtimeMs })
    } catch {
      // skip broken projects
    }
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getProject(id: string): Promise<SavedProject | null> {
  const dir = projectDir(id)
  try {
    const meta = await pfs.readFile(`${dir}/project.json`, 'utf8') as string
    const { name } = JSON.parse(meta)
    const dbml = await pfs.readFile(`${dir}/model.dbml`, 'utf8') as string
    const stat = await pfs.stat(`${dir}/model.dbml`)
    return { id, name, dbml, updatedAt: stat.mtimeMs }
  } catch {
    return null
  }
}

export async function saveProject(project: SavedProject): Promise<string> {
  const dir = projectDir(project.id)
  await ensureProjectsDir()

  // Initialize repo if it doesn't exist
  try {
    await pfs.stat(`${dir}/.git`)
  } catch {
    await initRepo(project.id)
  }

  // Write files
  await pfs.writeFile(`${dir}/model.dbml`, project.dbml, 'utf8')
  await pfs.writeFile(`${dir}/project.json`, JSON.stringify({ name: project.name }), 'utf8')

  // Stage and commit
  await git.add({ fs, dir, filepath: 'model.dbml' })
  await git.add({ fs, dir, filepath: 'project.json' })

  const now = new Date()
  const ts = now.toLocaleString('sv-SE', { hour12: false }).replace(',', '')
  const oid = await git.commit({
    fs,
    dir,
    message: `Save ${ts}`,
    author: { ...AUTHOR, timestamp: Math.floor(now.getTime() / 1000) },
  })

  return oid
}

export async function deleteProject(id: string): Promise<void> {
  const dir = projectDir(id)
  try {
    await removeDir(dir)
  } catch {
    // already gone
  }
}

async function removeDir(path: string): Promise<void> {
  const entries = await pfs.readdir(path)
  for (const entry of entries) {
    const full = `${path}/${entry}`
    const stat = await pfs.stat(full)
    if (stat.isDirectory()) {
      await removeDir(full)
    } else {
      await pfs.unlink(full)
    }
  }
  await pfs.rmdir(path)
}

export async function getHistory(id: string): Promise<CommitInfo[]> {
  const dir = projectDir(id)
  try {
    const commits = await git.log({ fs, dir })
    return commits.map((c) => ({
      oid: c.oid,
      message: c.commit.message,
      timestamp: c.commit.author.timestamp * 1000, // seconds → ms
    }))
  } catch {
    return []
  }
}

export async function getCommitContent(id: string, oid: string): Promise<string | null> {
  const dir = projectDir(id)
  try {
    const { blob } = await git.readBlob({ fs, dir, oid, filepath: 'model.dbml' })
    return new TextDecoder().decode(blob)
  } catch {
    return null
  }
}

export async function restoreCommit(id: string, oid: string): Promise<string | null> {
  const content = await getCommitContent(id, oid)
  if (!content) return null

  const dir = projectDir(id)
  await pfs.writeFile(`${dir}/model.dbml`, content, 'utf8')
  await git.add({ fs, dir, filepath: 'model.dbml' })

  const short = oid.slice(0, 7)
  const now = new Date()
  const commitOid = await git.commit({
    fs,
    dir,
    message: `Restore to ${short}`,
    author: { ...AUTHOR, timestamp: Math.floor(now.getTime() / 1000) },
  })

  return commitOid
}

// --- Source Config Persistence ---

export async function getSourceConfig(id: string): Promise<SourceConfig | null> {
  const dir = projectDir(id)
  try {
    const raw = await pfs.readFile(`${dir}/source_config.json`, 'utf8') as string
    return JSON.parse(raw) as SourceConfig
  } catch {
    return null
  }
}

export async function saveSourceConfig(id: string, config: SourceConfig): Promise<void> {
  const dir = projectDir(id)
  try {
    await pfs.stat(`${dir}/.git`)
  } catch {
    return // project doesn't exist yet
  }

  await pfs.writeFile(`${dir}/source_config.json`, JSON.stringify(config, null, 2), 'utf8')
  await git.add({ fs, dir, filepath: 'source_config.json' })

  const now = new Date()
  const ts = now.toLocaleString('sv-SE', { hour12: false }).replace(',', '')
  await git.commit({
    fs,
    dir,
    message: `Update sources ${ts}`,
    author: { ...AUTHOR, timestamp: Math.floor(now.getTime() / 1000) },
  })
}

// --- Migration from localStorage ---

const MIGRATION_KEY = 'dglml-projects'
const MIGRATION_DONE_KEY = 'dglml-migrated'

export async function migrateFromLocalStorage(): Promise<boolean> {
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return false

  const raw = localStorage.getItem(MIGRATION_KEY)
  if (!raw) {
    localStorage.setItem(MIGRATION_DONE_KEY, '1')
    return false
  }

  let projects: SavedProject[]
  try {
    projects = JSON.parse(raw) as SavedProject[]
  } catch {
    localStorage.setItem(MIGRATION_DONE_KEY, '1')
    return false
  }

  if (projects.length === 0) {
    localStorage.setItem(MIGRATION_DONE_KEY, '1')
    return false
  }

  for (const project of projects) {
    await saveProject(project)
  }

  localStorage.setItem(MIGRATION_DONE_KEY, '1')
  return true
}
