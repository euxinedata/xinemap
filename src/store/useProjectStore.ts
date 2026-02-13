import { create } from 'zustand'
import type { SavedProject, CommitInfo } from '../types'
import * as storage from '../persistence/gitStorage'
import { useEditorStore } from './useEditorStore'
import { useSourceConfigStore } from './useSourceConfigStore'
import { useDiagramStore } from './useDiagramStore'

interface ProjectState {
  currentProjectId: string | null
  projects: SavedProject[]
  commitHistory: CommitInfo[]
  loadProjectList: () => Promise<void>
  saveCurrentProject: (name: string) => Promise<void>
  openProject: (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  newProject: () => void
  loadHistory: () => Promise<void>
  restoreCommit: (oid: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>()((set) => ({
  currentProjectId: null,
  projects: [],
  commitHistory: [],

  loadProjectList: async () => {
    await storage.migrateFromLocalStorage()
    const projects = await storage.listProjects()
    set({ projects })
  },

  saveCurrentProject: async (name: string) => {
    const dbml = useEditorStore.getState().dbml
    const state = useProjectStore.getState()
    const id = state.currentProjectId ?? crypto.randomUUID()

    const project: SavedProject = { id, name, dbml, updatedAt: Date.now() }
    await storage.saveProject(project)

    const sourceConfig = useSourceConfigStore.getState().sourceConfig
    if (Object.keys(sourceConfig).length > 0) {
      await storage.saveSourceConfig(id, sourceConfig)
    }

    const storedLayout = useDiagramStore.getState().storedLayout
    if (storedLayout) {
      await storage.saveLayout(id, storedLayout)
    }

    const projects = await storage.listProjects()
    const history = await storage.getHistory(id)
    set({ currentProjectId: id, projects, commitHistory: history })
  },

  openProject: async (id: string) => {
    const project = await storage.getProject(id)
    if (!project) return
    useEditorStore.getState().setDbml(project.dbml)

    const sourceConfig = await storage.getSourceConfig(id)
    if (sourceConfig) {
      useSourceConfigStore.getState().setSourceConfig(sourceConfig)
    } else {
      useSourceConfigStore.getState().setSourceConfig({})
    }

    const layout = await storage.getLayout(id)
    const diagramStore = useDiagramStore.getState()
    diagramStore.setStoredLayout(layout)
    diagramStore.setCollapsedHubs(new Set(layout?.collapsedIds ?? []))
    if (layout?.layoutMode === 'snowflake' || layout?.layoutMode === 'dense') {
      diagramStore.setLayoutMode(layout.layoutMode)
    }

    const history = await storage.getHistory(id)
    set({ currentProjectId: id, commitHistory: history })
  },

  deleteProject: async (id: string) => {
    await storage.deleteProject(id)
    const projects = await storage.listProjects()
    set((state) => ({
      projects,
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      commitHistory: state.currentProjectId === id ? [] : state.commitHistory,
    }))
  },

  newProject: () => {
    useEditorStore.getState().setDbml('')
    useSourceConfigStore.getState().setSourceConfig({})
    useDiagramStore.getState().setStoredLayout(null)
    useDiagramStore.getState().setCollapsedHubs(new Set())
    set({ currentProjectId: null, commitHistory: [] })
  },

  loadHistory: async () => {
    const id = useProjectStore.getState().currentProjectId
    if (!id) return
    const history = await storage.getHistory(id)
    set({ commitHistory: history })
  },

  restoreCommit: async (oid: string) => {
    const id = useProjectStore.getState().currentProjectId
    if (!id) return
    const content = await storage.getCommitContent(id, oid)
    if (!content) return
    useEditorStore.getState().setDbml(content)
    await storage.restoreCommit(id, oid)
    const history = await storage.getHistory(id)
    set({ commitHistory: history })
  },
}))
