import { useCallback, useEffect, useState } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { EditorPanel } from './editor/EditorPanel'
import { DiagramPanel } from './diagram/DiagramPanel'
import { TabularPanel } from './tabular/TabularPanel'
import { ViewControlsBar } from './components/ViewControlsBar'
import { useParseEffect } from './hooks/useParseEffect'
import { useProjectStore } from './store/useProjectStore'
import { useDiagramStore } from './store/useDiagramStore'

export default function App() {
  useParseEffect()
  const [editorVisible, setEditorVisible] = useState(true)
  const toggleEditor = useCallback(() => setEditorVisible((v) => !v), [])
  const viewMode = useDiagramStore((s) => s.viewMode)

  // Auto-load the last opened project on startup
  useEffect(() => {
    const store = useProjectStore.getState()
    store.loadProjectList().then(() => {
      const lastId = localStorage.getItem('xinemap-last-project')
      const projects = useProjectStore.getState().projects
      if (projects.length === 0) return
      const target = lastId ? projects.find((p) => p.id === lastId) : undefined
      if (target) store.openProject(target.id)
    })
  }, [])
  return (
    <>
      <Toolbar />
      <div className="flex-1 min-h-0">
        <Allotment defaultSizes={[40, 60]}>
          <Allotment.Pane minSize={200} visible={editorVisible}>
            <EditorPanel />
          </Allotment.Pane>
          <Allotment.Pane minSize={300}>
            <div className="relative w-full h-full flex flex-col">
              <ViewControlsBar />
              <div className="flex-1 min-h-0 relative">
                {viewMode === 'tabular' ? <TabularPanel /> : <DiagramPanel />}
                <button
                  onClick={toggleEditor}
                  className="editor-toggle-handle"
                  title={editorVisible ? 'Hide editor' : 'Show editor'}
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {editorVisible
                      ? <polyline points="7,2 2,8 7,14" />
                      : <polyline points="3,2 8,8 3,14" />}
                  </svg>
                </button>
              </div>
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
      <StatusBar />
    </>
  )
}
