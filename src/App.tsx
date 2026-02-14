import { useEffect } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { EditorPanel } from './editor/EditorPanel'
import { DiagramPanel } from './diagram/DiagramPanel'
import { useParseEffect } from './hooks/useParseEffect'
import { useProjectStore } from './store/useProjectStore'

export default function App() {
  useParseEffect()

  // Auto-load the last opened project on startup
  useEffect(() => {
    const store = useProjectStore.getState()
    store.loadProjectList().then(() => {
      const lastId = localStorage.getItem('dglml-last-project')
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
          <Allotment.Pane minSize={200}>
            <EditorPanel />
          </Allotment.Pane>
          <Allotment.Pane minSize={300}>
            <DiagramPanel />
          </Allotment.Pane>
        </Allotment>
      </div>
      <StatusBar />
    </>
  )
}
