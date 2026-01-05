# Implementation Plan: Manual Region Selection

## Overview

本实现计划将手动框选切割功能分解为可执行的编码任务。采用增量开发方式，从核心几何工具开始，逐步构建选区管理、提取处理和 UI 组件，最后进行系统集成。

## Tasks

- [x] 1. 创建类型定义和几何工具函数
  - [x] 1.1 创建选区相关类型定义
    - 在 `src/types/selection.ts` 中定义 SelectionRegion、SelectionType、SelectionAction、SelectionState 类型
    - 定义 ExtractionOptions 接口和默认配置
    - _Requirements: 4.1, 10.2_

  - [x] 1.2 实现几何工具函数
    - 在 `src/utils/geometry.ts` 中实现 `isPointInPolygon`、`doEdgesIntersect`、`isPolygonSelfIntersecting`
    - 实现 `calculatePolygonBoundingBox`、`clampToImageBounds`
    - 实现坐标变换函数 `canvasToImageCoords`、`imageToCanvasCoords`
    - _Requirements: 1.3, 3.6, 5.2_

  - [x] 1.3 编写几何工具函数的属性测试
    - **Property 5: Polygon Non-Self-Intersection**
    - **Property 13: Polygon Masking Correctness**
    - **Property 14: Selection Coordinate Transformation**
    - **Validates: Requirements 1.3, 3.6, 5.2**

- [x] 2. 实现选区管理服务
  - [x] 2.1 创建选区管理器核心功能
    - 在 `src/services/selectionManager.ts` 中实现 `createRectangleSelection`、`createPolygonSelection`
    - 实现 `updateSelectionPosition`、`updateSelectionSize`
    - 实现 `generateSelectionId` 确保 ID 唯一性
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 3.1, 3.3_

  - [x] 2.2 实现多边形编辑功能
    - 实现 `movePolygonVertex`、`insertPolygonVertex`
    - 实现多边形闭合检测和自相交验证
    - _Requirements: 3.4, 3.5, 3.6_

  - [x] 2.3 实现撤销/重做功能
    - 实现 `SelectionHistory` 类管理操作历史
    - 实现 `pushAction`、`undo`、`redo` 方法
    - _Requirements: 7.4, 8.4_

  - [x] 2.4 编写选区管理器的属性测试
    - **Property 1: Rectangle Selection Bounds Validity**
    - **Property 2: Rectangle Resize Preserves Validity**
    - **Property 3: Rectangle Move Preserves Size**
    - **Property 4: Polygon Closure Consistency**
    - **Property 6: Polygon Vertex Edit Isolation**
    - **Property 7: Polygon Edge Vertex Insertion**
    - **Property 8: Selection ID Uniqueness**
    - **Property 10: Undo State Consistency**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 3.1, 3.3, 3.4, 3.5, 4.1, 7.4, 8.4**

- [x] 3. Checkpoint - 确保核心服务测试通过
  - 运行所有测试，确保几何工具和选区管理器功能正确
  - 如有问题请询问用户

- [x] 4. 实现区域提取和标准化服务
  - [x] 4.1 创建区域提取器
    - 在 `src/services/regionExtractor.ts` 中实现 `extractRectangleRegion`
    - 实现 `extractPolygonRegion`，使用多边形遮罩
    - 复用现有的 `cropWithPolygon` 和 `removeBackgroundFloodFill`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.2 创建表情包标准化器
    - 在 `src/services/emojiNormalizer.ts` 中实现 `normalizeEmoji`
    - 实现 240×240 尺寸标准化，保持宽高比
    - 实现居中和透明填充
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 4.3 编写提取和标准化的属性测试
    - **Property 11: Output Size Normalization**
    - **Property 12: Centering and Transparency**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.5**

- [x] 5. 创建选区状态管理 Store
  - [x] 5.1 创建 useSelectionStore
    - 在 `src/store/useSelectionStore.ts` 中创建 Zustand store
    - 实现 selections、activeSelectionId、mode、history 状态
    - 实现 addSelection、removeSelection、updateSelection、setActiveSelection 方法
    - 实现 undo、redo、clearAll 方法
    - _Requirements: 4.1, 4.4, 4.5, 7.4_

  - [x] 5.2 编写 Store 的属性测试
    - **Property 9: Keyboard Deletion Removes Active Selection**
    - **Property 17: Store Update on Extraction**
    - **Property 18: Selection Count Display Accuracy**
    - **Property 19: Multi-Selection via Shift+Click**
    - **Validates: Requirements 4.4, 4.6, 7.6, 10.1**

- [x] 6. Checkpoint - 确保服务层测试通过
  - 运行所有测试，确保提取、标准化和 Store 功能正确
  - 如有问题请询问用户

- [x] 7. 实现 SelectionCanvas 组件
  - [x] 7.1 创建画布基础结构
    - 在 `src/components/SelectionCanvas.tsx` 中创建组件
    - 实现图片加载和显示，保持宽高比
    - 实现缩放和平移功能（鼠标滚轮、拖拽）
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 7.2 实现矩形选区绘制
    - 实现鼠标按下、拖拽、释放事件处理
    - 实现实时预览（半透明填充、边框）
    - 实现选区调整手柄（角点、边缘）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 7.3 实现多边形选区绘制
    - 实现点击添加顶点、双击闭合
    - 实现顶点拖拽编辑
    - 实现边点击插入新顶点
    - 实现自相交检测和警告显示
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 7.4 实现键盘快捷键
    - 实现 R/P 键切换模式
    - 实现 Escape 取消当前绘制
    - 实现 Delete/Backspace 删除选区
    - 实现 Ctrl+Z/Cmd+Z 撤销
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 7.5 编写画布交互的属性测试
    - **Property 15: Aspect Ratio Preservation on Canvas**
    - **Property 20: Escape Cancels In-Progress Selection**
    - **Validates: Requirements 1.2, 8.3**

- [x] 8. 实现 SelectionToolPanel 组件
  - [x] 8.1 创建工具面板
    - 在 `src/components/SelectionToolPanel.tsx` 中创建组件
    - 实现模式切换按钮（矩形/多边形）
    - 实现提取、清空、撤销按钮
    - 实现选区计数显示
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.2 实现状态反馈
    - 实现加载指示器
    - 实现成功/错误消息显示
    - _Requirements: 9.3, 9.4, 9.5_

- [x] 9. 实现 SelectionList 组件
  - [x] 9.1 创建选区列表
    - 在 `src/components/SelectionList.tsx` 中创建组件
    - 实现选区缩略图生成和显示
    - 实现选区点击选中
    - 实现删除按钮
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 10. 实现 ManualSelectionPanel 主组件
  - [x] 10.1 创建主面板组件
    - 在 `src/components/ManualSelectionPanel.tsx` 中创建组件
    - 整合 SelectionCanvas、SelectionToolPanel、SelectionList
    - 实现图片上传和加载逻辑
    - _Requirements: 1.1, 1.4_

  - [x] 10.2 实现提取流程
    - 实现批量提取逻辑
    - 调用 regionExtractor 和 emojiNormalizer
    - 将结果添加到 extractedEmojis store
    - _Requirements: 5.1, 5.5, 10.1, 10.3_

  - [x] 10.3 编写集成测试
    - **Property 16: Store Integration Data Structure**
    - **Validates: Requirements 10.2**

- [x] 11. 系统集成
  - [x] 11.1 集成到现有 UI
    - 在 ManualSplitPanel 或 WorkPanel 中添加手动框选入口
    - 添加模式切换（自动切割 / 手动框选）
    - _Requirements: 10.3, 10.4_

  - [x] 11.2 更新组件导出
    - 在 `src/components/index.ts` 中导出新组件
    - 在 `src/services/index.ts` 中导出新服务
    - _Requirements: 10.4_

- [x] 12. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证端到端流程
  - 如有问题请询问用户

## Notes

- 每个任务都引用了具体的需求条款以确保可追溯性
- 属性测试验证通用正确性属性，单元测试覆盖具体示例和边缘情况
- Checkpoint 任务确保增量验证，及早发现问题
- 所有测试任务均为必需，确保从一开始就有全面的测试覆盖
