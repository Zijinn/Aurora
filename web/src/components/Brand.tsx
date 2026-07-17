import { StackSimple } from "@phosphor-icons/react"

export function Brand() {
  return (
    <div className="brand" aria-label="Cairn">
      <span className="brand__mark" aria-hidden="true">
        <StackSimple weight="bold" />
      </span>
      <span className="brand__name">Cairn</span>
    </div>
  )
}

