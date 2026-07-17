import { Sparkle } from "@phosphor-icons/react"

export function Brand() {
  return (
    <div className="brand" aria-label="Aurora">
      <span className="brand__mark" aria-hidden="true">
        <Sparkle weight="fill" />
      </span>
      <span className="brand__name">Aurora</span>
    </div>
  )
}
