import fs from 'node:fs/promises'
import JSZip from 'jszip'
import { PNG } from 'pngjs'

function solidPng(width, height, [red, green, blue]) {
  const image = new PNG({ width, height })
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = red
    image.data[offset + 1] = green
    image.data[offset + 2] = blue
    image.data[offset + 3] = 255
  }
  return PNG.sync.write(image)
}

const archive = new JSZip()
archive.file('BOTTLE-001_1.png', solidPng(1200, 1200, [37, 87, 214]))
archive.file('LAMP-002_1.png', solidPng(720, 720, [246, 183, 60]))
archive.file('CABLE-005_1.gif', Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'))
archive.file('ORPHAN-999_1.png', solidPng(1200, 1200, [15, 139, 141]))

await fs.writeFile(
  new URL('../public/listinglint-demo-images.zip', import.meta.url),
  await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
)
