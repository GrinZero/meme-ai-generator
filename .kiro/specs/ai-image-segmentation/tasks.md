# Implementation Plan: AI Image Segmentation

## Overview

本实现计划将 AI 图像分割功能分解为可执行的编码任务。采用增量开发方式，从类型定义开始，逐步实现核心服务，最后集成到现有系统中。

## Tasks

- [x] 1. 定义数据类型和接口
  - [x] 1.1 创建 `src/types/segmentation.ts` 类型定义文件
    - 定义 Point、Polygon、SegmentationRegion、SegmentationResult 类型
    - 定义 AISegmentationConfig 配置类型
    - 导出所有类型到 `src/types/index.ts`
    - _Requirements: 2.1, 2.4_

- [x] 2. 实现坐标工具函数
  - [x] 2.1 创建 `src/services/coordinateUtils.ts`
    - 实现 `isValidPolygon()` 验证多边形有效性
    - 实现 `clampCoordinates()` 限制坐标边界
    - 实现 `normalizeCoordinates()` 百分比转像素
    - 实现 `rectangleToBoundingBox()` 矩形转换
    - 实现 `boundingBoxToPolygon()` 边界框转多边形
    - _Requirements: 2.2, 2.3, 3.3, 3.4_
  - [x] 2.2 编写坐标工具属性测试
    - **Property 2: Polygon Vertex Validation**
    - **Property 3: Rectangle to BoundingBox Conversion**
    - **Property 5: Coordinate Clamping**
    - **Property 6: Coordinate Normalization**
    - **Validates: Requirements 2.2, 2.3, 3.3, 3.4**

- [x] 3. 实现 AI 分割服务
  - [x] 3.1 创建 `src/services/aiSegmentationService.ts`
    - 实现 `buildPrompt()` 构建分割 prompt
    - 实现 `parseResponse()` 解析 AI 响应
    - 实现 `compressImage()` 图片压缩
    - 实现 `segment()` 主分割方法
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.2, 6.1, 6.2, 6.3, 6.4_
  - [x] 3.2 编写 AI 分割服务属性测试
    - **Property 1: Image Compression Threshold**
    - **Property 4: JSON Parsing Robustness**
    - **Property 10: API Error Handling**
    - **Validates: Requirements 1.3, 1.4, 3.1, 3.2**

- [x] 4. Checkpoint - 验证核心服务
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 实现多边形裁剪服务
  - [x] 5.1 创建 `src/services/polygonCropper.ts`
    - 实现 `calculatePolygonBoundingBox()` 计算边界框
    - 实现 `isConvexPolygon()` 判断凸多边形
    - 实现 `cropWithPolygon()` 多边形裁剪
    - 实现 `extractEmojisFromRegions()` 批量提取
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 编写多边形裁剪属性测试
    - **Property 7: Polygon Bounding Box Calculation**
    - **Property 8: Polygon Clipping Transparency**
    - **Validates: Requirements 4.1, 4.2**

- [x] 6. 实现回退机制
  - [x] 6.1 更新 `src/services/imageSplitter.ts`
    - 添加 `extractAllEmojisWithAI()` 方法
    - 实现 AI 分割失败时的回退逻辑
    - 集成 AISegmentationService 和 PolygonCropper
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 6.2 编写回退机制属性测试
    - **Property 9: Fallback Behavior**
    - **Validates: Requirements 5.1**

- [x] 7. Checkpoint - 验证完整功能
  - 确保所有测试通过，如有问题请询问用户

- [x] 8. 集成到 UI
  - [x] 8.1 更新 store 添加 AI 分割配置
    - 在 `src/store/useAppStore.ts` 添加 aiSegmentationConfig 状态
    - 添加切换 AI/传统分割的 action
    - _Requirements: 5.3_
  - [x] 8.2 更新 GeneratePanel 组件
    - 添加 AI 分割开关选项
    - 调用新的 `extractAllEmojisWithAI()` 方法
    - 显示分割方法指示（AI/传统）
    - _Requirements: 5.2, 5.3_

- [x] 9. Final Checkpoint - 完整功能验证
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 所有任务都是必须完成的，包括属性测试
- 使用 fast-check 库进行属性测试
- 属性测试配置为至少 100 次迭代
- 每个属性测试需要注释引用设计文档中的属性编号
