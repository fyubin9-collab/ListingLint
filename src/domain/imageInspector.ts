import JSZip from 'jszip'
import type { ImageAsset } from './types'

export const MAX_ZIP_BYTES = 100 * 1024 * 1024
export const MAX_IMAGE_FILES = 1_000
const DECODABLE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

export class ImageZipError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageZipError'
  }
}

export interface ImageDimensions {
  width: number
  height: number
}

export type ImageDecoder = (blob: Blob) => Promise<ImageDimensions>

function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

export function parseImageSku(path: string, knownSkus: string[] = []): string {
  const fileName = fileNameFromPath(path)
  const dotIndex = fileName.lastIndexOf('.')
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const normalizedStem = stem.toLocaleLowerCase()
  const exactOrIndexed = [...knownSkus]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((sku) => {
      const normalizedSku = sku.toLocaleLowerCase()
      return normalizedStem === normalizedSku || new RegExp(`^${escapeRegExp(normalizedSku)}_\\d+$`).test(normalizedStem)
    })
  if (exactOrIndexed) return exactOrIndexed
  return stem.replace(/_\d+$/, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function decodeImageDimensions(blob: Blob): Promise<ImageDimensions> {
  if ('createImageBitmap' in globalThis) {
    const bitmap = await createImageBitmap(blob)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(blob)
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(dimensions)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('浏览器无法解码该图片'))
    }
    image.src = url
  })
}

function shouldIgnore(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  const fileName = fileNameFromPath(normalized)
  return normalized.startsWith('__MACOSX/') || fileName === '.DS_Store' || fileName.startsWith('._')
}

export async function inspectImageZip(
  file: File,
  knownSkus: string[],
  onProgress?: (completed: number, total: number) => void,
  decode: ImageDecoder = decodeImageDimensions
): Promise<ImageAsset[]> {
  if (file.size === 0) throw new ImageZipError('图片 ZIP 为空。')
  if (file.size > MAX_ZIP_BYTES) throw new ImageZipError('图片 ZIP 超过 100MB 上限，请拆分后重试。')
  if (file.name.split('.').pop()?.toLocaleLowerCase() !== 'zip') {
    throw new ImageZipError('图片包必须是 .zip 文件。')
  }

  let archive: JSZip
  try {
    archive = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw new ImageZipError('无法读取图片 ZIP。文件可能已损坏、加密或不是有效压缩包。')
  }

  const entries = Object.values(archive.files).filter((entry) => !entry.dir && !shouldIgnore(entry.name))
  if (entries.length === 0) throw new ImageZipError('图片 ZIP 中没有可检查的文件。')
  if (entries.length > MAX_IMAGE_FILES) {
    throw new ImageZipError(`图片数量超过 ${MAX_IMAGE_FILES.toLocaleString()} 张上限。`)
  }

  const assets: ImageAsset[] = []
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const fileName = fileNameFromPath(entry.name)
    const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLocaleLowerCase() : ''
    const blob = await entry.async('blob')
    const asset: ImageAsset = {
      name: entry.name,
      sku: parseImageSku(entry.name, knownSkus),
      extension,
      size: blob.size,
      width: null,
      height: null
    }
    if (DECODABLE_EXTENSIONS.has(extension)) {
      try {
        const dimensions = await decode(blob)
        asset.width = dimensions.width
        asset.height = dimensions.height
      } catch (error) {
        asset.decodeError = error instanceof Error ? error.message : '浏览器无法解码该图片'
      }
    }
    assets.push(asset)
    onProgress?.(index + 1, entries.length)
  }
  return assets
}
