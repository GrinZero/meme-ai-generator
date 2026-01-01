import '@testing-library/jest-dom'
import { createCanvas, ImageData as NodeImageData } from 'canvas'

// 设置 canvas 支持 (用于 jsdom 环境)
// 使用 node-canvas 提供真实的 Canvas API 实现

// 模拟 HTMLCanvasElement.prototype.getContext
const originalGetContext = HTMLCanvasElement.prototype.getContext

HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  contextId: string,
  options?: unknown
): RenderingContext | null {
  if (contextId === '2d') {
    const nodeCanvas = createCanvas(this.width || 300, this.height || 150)
    const ctx = nodeCanvas.getContext('2d')

    // 同步尺寸变化
    const originalWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')
    const originalHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height')

    Object.defineProperty(this, 'width', {
      get() { return originalWidthDescriptor?.get?.call(this) || 300 },
      set(value) {
        originalWidthDescriptor?.set?.call(this, value)
        nodeCanvas.width = value
      }
    })

    Object.defineProperty(this, 'height', {
      get() { return originalHeightDescriptor?.get?.call(this) || 150 },
      set(value) {
        originalHeightDescriptor?.set?.call(this, value)
        nodeCanvas.height = value
      }
    })

    return ctx as unknown as CanvasRenderingContext2D
  }
  return originalGetContext.call(this, contextId, options as CanvasRenderingContext2DSettings)
} as typeof HTMLCanvasElement.prototype.getContext

// 确保全局 ImageData 可用
if (typeof globalThis.ImageData === 'undefined') {
  Object.defineProperty(globalThis, 'ImageData', {
    value: NodeImageData,
    writable: true,
    configurable: true
  })
}
