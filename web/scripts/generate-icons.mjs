import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { StackSimple } from "@phosphor-icons/react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import sharp from "sharp"

const outputDir = resolve(import.meta.dirname, "../public/icons")
await mkdir(outputDir, { recursive: true })

const makeIcon = async (size, maskable = false) => {
  const iconSize = Math.round(size * (maskable ? 0.48 : 0.58))
  const icon = renderToStaticMarkup(
    createElement(StackSimple, {
      color: "#f4f3ef",
      size: iconSize,
      weight: "bold",
    }),
  )
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#153f3b",
    },
  })
    .composite([{ input: Buffer.from(icon), gravity: "center" }])
    .png()
}

for (const [name, size, maskable] of [
  ["cairn-192.png", 192, false],
  ["cairn-512.png", 512, false],
  ["cairn-maskable-512.png", 512, true],
]) {
  await (await makeIcon(size, maskable)).toFile(resolve(outputDir, name))
}
