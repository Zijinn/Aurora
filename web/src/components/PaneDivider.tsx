import { useRef, type KeyboardEvent, type PointerEvent } from "react"

interface PaneDividerProps {
  edge: "sidebar" | "timeline"
  value: number
  min: number
  max: number
  label: string
  onStart: () => void
  onDelta: (delta: number) => void
  onEnd: () => void
}

export function PaneDivider(props: PaneDividerProps) {
  const origin = useRef<number | null>(null)
  const begin = (event: PointerEvent<HTMLButtonElement>) => {
    origin.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
    props.onStart()
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (origin.current === null) return
    props.onDelta(event.clientX - origin.current)
  }
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    if (origin.current === null) return
    origin.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    props.onEnd()
  }
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (!direction) return
    event.preventDefault()
    props.onStart()
    props.onDelta(direction * 16)
    props.onEnd()
  }
  return (
    <button
      className={`pane-divider pane-divider--${props.edge}`}
      type="button"
      role="separator"
      aria-label={props.label}
      aria-orientation="vertical"
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      aria-valuenow={props.value}
      title={props.label}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={keyDown}
    />
  )
}
