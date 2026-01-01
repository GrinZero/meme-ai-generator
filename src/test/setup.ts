import '@testing-library/jest-dom'
import { createCanvas, ImageData as NodeImageData } from 'canvas'

// 设置 canvas 支持 (用于 jsdom 环境)
// 使用 node-canvas 提供真实的 Canvas API 实现

// 模拟 HTMLCanvasElement.prototype.getContext
const originalGetContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function(
  contextId: string,
  options?: CanvasRenderingContext2DSettings
): RenderingContext | null {
  if (contextId === '2d') {
    const nodeCanvas = createCanvas(this.width || 300, this.height || 150)
    const ctx = nodeCanvas.getContext('2d')
    
    // 同步尺寸变化
    const self = this
    const originalWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')
    const originalHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height')
    
    Object.defineProperty(this, 'width', {
      get() { return originalWidthDescriptor?.get?.call(self) || 300 },
      set(value) {
        originalWidthDescriptor?.set?.call(self, value)
        ;(nodeCanvas as any).width = value
      }
    })
    
    Object.defineProperty(this, 'height', {
      get() { return originalHeightDescriptor?.get?.call(self) || 150 },
      set(value) {
        originalHeightDescriptor?.set?.call(self, value)
        ;(nodeCanvas as any).height = value
      }
    })
    
    return ctx as unknown as CanvasRenderingContext2D
  }
  return originalGetContext.call(this, contextId, options)
}

// 确保全局 ImageData 可用
if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as any).ImageData = NodeImageData
}
