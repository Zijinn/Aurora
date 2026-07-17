import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import sharp from "sharp"

const sourcePath = resolve(import.meta.dirname, "../assets/brand/aurora-product-icon.png")
const outputDir = resolve(import.meta.dirname, "../public/icons")
const nativeOutputDir = resolve(import.meta.dirname, "../../build/icons")
await mkdir(outputDir, { recursive: true })
await mkdir(nativeOutputDir, { recursive: true })

const metadata = await sharp(sourcePath).metadata()
if (metadata.width !== metadata.height || (metadata.width ?? 0) < 1024) {
  throw new Error("Aurora icon source must be a square image at least 1024px wide")
}

const writeIcon = (path, size) =>
  sharp(sourcePath)
    .rotate()
    .resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .toColorspace("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path)

for (const [name, size] of [
  ["aurora-32.png", 32],
  ["aurora-180.png", 180],
  ["aurora-192.png", 192],
  ["aurora-512.png", 512],
  ["aurora-maskable-512.png", 512],
]) {
  await writeIcon(resolve(outputDir, name), size)
}

await writeIcon(resolve(nativeOutputDir, "Aurora-1024.png"), 1024)
