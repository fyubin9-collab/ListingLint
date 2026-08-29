import JSZip from 'jszip'
import { ImageZipError, inspectImageZip, parseImageSku } from './imageInspector'

describe('image ZIP inspector', () => {
  it('matches exact and indexed filenames against the longest known SKU', () => {
    expect(parseImageSku('folder/SKU_12_1.jpg', ['SKU', 'SKU_12'])).toBe('SKU_12')
    expect(parseImageSku('SKU-2.png', ['SKU-2'])).toBe('SKU-2')
    expect(parseImageSku('UNKNOWN_3.webp')).toBe('UNKNOWN')
  })

  it('extracts image metadata, ignores macOS metadata and reports progress', async () => {
    const zip = new JSZip()
    zip.file('SKU-1_1.jpg', new Uint8Array([1, 2, 3]))
    zip.file('__MACOSX/._SKU-1_1.jpg', new Uint8Array([0]))
    zip.file('notes.txt', 'not an image')
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const progress: number[] = []
    const zipBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const file = new File([zipBuffer], 'images.zip', { type: 'application/zip' })

    const assets = await inspectImageZip(
      file,
      ['SKU-1'],
      (completed) => progress.push(completed),
      async () => ({ width: 1200, height: 1400 })
    )

    expect(assets).toHaveLength(2)
    expect(assets[0]).toMatchObject({ sku: 'SKU-1', extension: 'jpg', width: 1200, height: 1400 })
    expect(assets[1]).toMatchObject({ extension: 'txt', width: null, height: null })
    expect(progress).toEqual([1, 2])
  })

  it('rejects empty or non-ZIP inputs', async () => {
    await expect(inspectImageZip(new File([], 'images.zip'), [])).rejects.toThrow(ImageZipError)
    await expect(inspectImageZip(new File(['x'], 'images.rar'), [])).rejects.toThrow('必须是 .zip')
  })
})
