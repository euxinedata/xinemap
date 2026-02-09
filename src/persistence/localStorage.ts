import type { SavedProject } from '../types'

const STORAGE_KEY = 'dglml-projects'

function readAll(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedProject[]) : []
  } catch {
    return []
  }
}

function writeAll(projects: SavedProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export function listProjects(): SavedProject[] {
  return readAll()
}

export function getProject(id: string): SavedProject | null {
  return readAll().find((p) => p.id === id) ?? null
}

export function saveProject(project: SavedProject): void {
  const projects = readAll()
  const idx = projects.findIndex((p) => p.id === project.id)
  if (idx >= 0) {
    projects[idx] = project
  } else {
    projects.push(project)
  }
  writeAll(projects)
}

export function deleteProject(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id))
}
