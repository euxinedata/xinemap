import { create } from 'zustand'
import type { SavedProject } from '../types'
import * as storage from '../persistence/localStorage'
import { useEditorStore, DEFAULT_DBML } from './useEditorStore'

interface ProjectState {
  currentProjectId: string | null
  projects: SavedProject[]
  loadProjectList: () => void
  saveCurrentProject: (name: string) => void
  openProject: (id: string) => void
  deleteProject: (id: string) => void
  newProject: () => void
}

export const useProjectStore = create<ProjectState>()((set) => ({
  currentProjectId: null,
  projects: [],

  loadProjectList: () => {
    set({ projects: storage.listProjects() })
  },

  saveCurrentProject: (name: string) => {
    const dbml = useEditorStore.getState().dbml
    const state = useProjectStore.getState()
    const existing = state.currentProjectId
      ? storage.getProject(state.currentProjectId)
      : null

    const project: SavedProject = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      dbml,
      updatedAt: Date.now(),
    }

    storage.saveProject(project)
    set({ currentProjectId: project.id, projects: storage.listProjects() })
  },

  openProject: (id: string) => {
    const project = storage.getProject(id)
    if (!project) return
    useEditorStore.getState().setDbml(project.dbml)
    set({ currentProjectId: id })
  },

  deleteProject: (id: string) => {
    storage.deleteProject(id)
    set((state) => ({
      projects: storage.listProjects(),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
    }))
  },

  newProject: () => {
    useEditorStore.getState().setDbml(DEFAULT_DBML)
    set({ currentProjectId: null })
  },
}))
