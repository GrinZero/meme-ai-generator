# Implementation Plan: WeChat Standardization Enhancement

## Overview

本实现计划涵盖微信表情标准化功能的四项增强：AI 生成大图保存、赞赏图生成、提示词优化、页面布局重设计。采用增量开发方式，确保每个功能模块独立可测试。

## Tasks

- [x] 1. AI 生成大图保存功能
  - [x] 1.1 创建 SaveButton 组件
    - 在 `src/components/SaveButton.tsx` 创建保存按钮组件
    - 接收 imageBlob 和 filenamePrefix 属性
    - 实现下载功能，文件名格式为 `emoji_generated_{timestamp}.png`
    - 当 imageBlob 为 null 时不渲染或禁用
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 集成 SaveButton 到 WorkPanel
    - 在 `src/components/WorkPanel.tsx` 的生成结果预览区域添加 SaveButton
    - 传入 generatedImage 作为 imageBlob
    - _Requirements: 1.1, 1.2_

  - [ ]* 1.3 编写 SaveButton 属性测试
    - **Property 1: Save Button Visibility Consistency**
    - **Property 2: Generated Image Filename Format**
    - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 2. 扩展微信规格常量和类型定义
  - [x] 2.1 更新 wechatConstants.ts
    - 添加 APPRECIATION_GUIDE 和 APPRECIATION_THANKS 规格定义
    - 更新 DEFAULT_PROMPTS，优化 P1/P2/P3 提示词
    - 添加赞赏图默认提示词
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 3.1-3.11_

  - [x] 2.2 更新 wechatStandardization.ts 类型定义
    - 扩展 ProcessedImage 类型，添加新的图片类型
    - 扩展 StandardizationPrompts 类型
    - 扩展 StandardizationResult 类型
    - 添加 ImageType、ProcessingParams 等新类型
    - _Requirements: 2.3, 2.4_

- [x] 3. 扩展 Store 状态管理
  - [x] 3.1 更新 useWeChatStandardizationStore
    - 添加 enableAppreciation 状态和 setter
    - 添加 selectedImageType 状态和 setter
    - 添加 reprocessPrompt、reprocessParams、reprocessResult 状态
    - 实现 regenerateSelected、replaceWithReprocessed、cancelReprocess actions
    - _Requirements: 2.1, 2.2, 4.3, 4.6, 4.9, 4.10_

  - [ ]* 3.2 编写 Store 属性测试
    - **Property 4: Prompt State Management**
    - **Property 7: Reprocess Prompt Isolation**
    - **Property 8: Replace Operation Correctness**
    - **Property 9: Cancel Operation Correctness**
    - **Validates: Requirements 2.7, 2.8, 4.6, 4.9, 4.10**

- [x] 4. 实现赞赏图生成服务
  - [x] 4.1 扩展 wechatImageProcessor.ts
    - 添加 processToAppreciationGuide 函数（750×560）
    - 添加 processToAppreciationThanks 函数（750×750）
    - 添加对应的压缩函数
    - _Requirements: 2.3, 2.4_

  - [x] 4.2 扩展 wechatStandardizationService.ts
    - 添加 generateAppreciationGuide 函数
    - 添加 generateAppreciationThanks 函数
    - 更新 generateAll 函数，支持可选的赞赏图生成
    - _Requirements: 2.3, 2.4, 2.9_

  - [ ]* 4.3 编写赞赏图处理属性测试
    - **Property 3: Appreciation Image Size Compliance**
    - **Validates: Requirements 2.3, 2.4**

- [ ] 5. Checkpoint - 确保所有测试通过
  - 运行所有测试，确保无回归
  - 如有问题请询问用户

- [x] 6. 创建 UI 组件
  - [x] 6.1 创建 PreviewGallery 组件
    - 在 `src/components/PreviewGallery.tsx` 创建预览图库组件
    - 显示 P1/P2/P3/赞赏图的缩略图
    - 支持点击选择图片
    - 高亮显示选中的图片
    - _Requirements: 4.2, 4.3_

  - [x] 6.2 创建 ReprocessPanel 组件
    - 在 `src/components/ReprocessPanel.tsx` 创建单独处理面板
    - 包含提示词编辑区
    - 包含切割参数配置（容差、最小区域、最小尺寸）
    - 显示原图和新图对比
    - 包含重新生成、替换、取消按钮
    - _Requirements: 4.4, 4.5, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [x] 6.3 创建 AppreciationPromptEditor 组件
    - 在 `src/components/AppreciationPromptEditor.tsx` 创建赞赏图提示词编辑器
    - 包含赞赏引导图和赞赏致谢图的提示词编辑区
    - 支持重置为默认提示词
    - _Requirements: 2.5, 2.6, 2.7, 2.8_

  - [ ]* 6.4 编写 UI 组件属性测试
    - **Property 6: Image Selection State Consistency**
    - **Validates: Requirements 4.3, 4.4**

- [x] 7. 重构 WeChatStandardizationPanel
  - [x] 7.1 更新主面板布局
    - 移除右侧"提取的表情"区域
    - 集成 PreviewGallery 组件
    - 集成 ReprocessPanel 组件
    - 添加"生成赞赏图"复选框
    - 集成 AppreciationPromptEditor 组件
    - _Requirements: 2.1, 2.2, 4.1, 4.2_

  - [x] 7.2 更新生成流程
    - 根据 enableAppreciation 状态决定是否生成赞赏图
    - 更新进度显示，包含赞赏图生成进度
    - _Requirements: 2.2, 2.9_

  - [x] 7.3 实现图片选择和重新处理流程
    - 点击预览图时设置 selectedImageType
    - 显示 ReprocessPanel
    - 实现重新生成、替换、取消逻辑
    - _Requirements: 4.3, 4.4, 4.7, 4.9, 4.10_

- [-] 8. 更新下载功能
  - [x] 8.1 扩展 wechatFileService.ts
    - 更新 downloadStandardizationZip 函数
    - 当赞赏图存在时将其包含在 ZIP 包中
    - 使用正确的文件命名
    - _Requirements: 2.10_

  - [ ] 8.2 编写下载功能属性测试
    - **Property 5: ZIP Package Contents with Appreciation Images**
    - **Validates: Requirements 2.10**

- [ ] 9. Final Checkpoint - 确保所有测试通过
  - 运行所有测试，确保无回归
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选测试任务，可跳过以加快 MVP 开发
- 每个任务引用了具体的需求条目以便追溯
- 属性测试验证核心正确性属性
- 单元测试验证具体示例和边界情况
