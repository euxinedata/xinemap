import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { EditorPanel } from './editor/EditorPanel'
import { DiagramPanel } from './diagram/DiagramPanel'
import { useParseEffect } from './hooks/useParseEffect'

export default function App() {
  useParseEffect()
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
