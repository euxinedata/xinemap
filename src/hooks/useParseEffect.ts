import { useEffect, useRef } from 'react'
import { useEditorStore } from '../store/useEditorStore'
import { parseDbml } from '../parser/parseDbml'

export function useParseEffect() {
  const dbml = useEditorStore((s) => s.dbml)
  const setParseResult = useEditorStore((s) => s.setParseResult)
  const setParseErrors = useEditorStore((s) => s.setParseErrors)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const result = parseDbml(dbml)
      if (result.errors.length === 0) {
        setParseResult(result)
        setParseErrors([])
      } else {
        setParseResult(null)
        setParseErrors(result.errors)
      }
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [dbml, setParseResult, setParseErrors])
}
