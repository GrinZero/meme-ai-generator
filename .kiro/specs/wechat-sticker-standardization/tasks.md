# Implementation Plan: WeChat Sticker Standardization

## Overview

实现微信表情平台标准化功能，包括多图上传、提示词配置、AI 生成、图像处理（尺寸调整、背景透明化）、文件压缩和导出功能。采用增量开发方式，先实现核心服务层，再构建 UI 组件。

## Tasks

- [x] 1. 创建类型定义和常量
  - [x] 1.1 创建 `src/types/wechatStandardization.ts` 类型定义文件
    - 定义 SourceImage、ProcessedImage、StandardizationPrompts 等接口
    - 定义 ProcessingStatus 状态类型
    - 定义 StandardizationError 错误类型
    - _Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.7, 4.1-4.8, 5.1-5.6, 6.1-6.8_
  - [x] 1.2 创建 `src/services/wechatConstants.ts` 常量文件
    - 定义微信平台规格常量（尺寸、大小限制）
    - 定义默认提示词
    - 定义支持的文件格式
    - _Requirements: 2.2, 2.3, 2.4, 4.1-4.3, 6.6-6.8_

- [x] 2. 实现图像处理服务
  - [x] 2.1 创建 `src/services/wechatImageProcessor.ts` 图像处理服务
    - 实现 resizeImage 函数（居中裁剪，保持比例）
    - 实现 processToBanner 函数（750×400）
    - 实现 processToCover 函数（240×240）
    - 实现 processToIcon 函数（50×50）
    - _Requirements: 4.1-4.5_
  - [ ]* 2.2 编写图像尺寸标准化属性测试
    - **Property 5: Image Size Standardization**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [ ]* 2.3 编写宽高比保持属性测试
    - **Property 6: Aspect Ratio Preservation**
    - **Validates: Requirements 4.4, 4.5**

- [x] 3. 实现文件压缩服务
  - [x] 3.1 在 `src/services/wechatImageProcessor.ts` 中添加压缩功能
    - 实现 compressImage 函数（支持 PNG/JPEG）
    - 实现 compressToBannerLimit 函数（≤500KB）
    - 实现 compressToCoverLimit 函数（≤500KB）
    - 实现 compressToIconLimit 函数（≤100KB）
    - _Requirements: 6.6, 6.7, 6.8_
  - [ ]* 3.2 编写文件大小压缩属性测试
    - **Property 9: File Size Compression**
    - **Validates: Requirements 6.6, 6.7, 6.8**

- [x] 4. 实现背景移除服务
  - [x] 4.1 创建 `src/services/wechatBackgroundRemover.ts` 背景移除服务
    - 复用现有 @imgly/background-removal 库
    - 实现 removeBackgroundForCover 函数
    - 实现 removeBackgroundForIcon 函数
    - 添加回退到简单背景移除的逻辑
    - _Requirements: 5.1-5.3_
  - [ ]* 4.2 编写背景透明化属性测试
    - **Property 8: Background Transparency**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 5. Checkpoint - 核心服务层完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 6. 实现文件验证和命名服务
  - [x] 6.1 创建 `src/services/wechatFileService.ts` 文件服务
    - 实现 validateImageFormat 函数
    - 实现 generateStandardFileName 函数
    - 实现 createStandardizationZip 函数
    - _Requirements: 1.2, 1.6, 6.4, 6.5_
  - [ ]* 6.2 编写文件格式验证属性测试
    - **Property 1: File Format Validation**
    - **Validates: Requirements 1.2, 1.6**
  - [ ]* 6.3 编写文件命名规范属性测试
    - **Property 10: File Naming Convention**
    - **Validates: Requirements 6.5**
  - [ ]* 6.4 编写 ZIP 包内容属性测试
    - **Property 11: ZIP Package Contents**
    - **Validates: Requirements 6.4**

- [x] 7. 实现状态管理 Store
  - [x] 7.1 创建 `src/store/useWeChatStandardizationStore.ts`
    - 实现源图片管理（添加、删除、清空、导入）
    - 实现提示词管理（设置、重置）
    - 实现处理状态管理
    - 实现生成流程控制
    - _Requirements: 1.3-1.5, 2.5-2.6, 3.1, 7.3_
  - [ ]* 7.2 编写上传数量限制属性测试
    - **Property 2: Upload Count Limit**
    - **Validates: Requirements 1.3, 1.7**
  - [ ]* 7.3 编写图片删除一致性属性测试
    - **Property 3: Image Deletion Consistency**
    - **Validates: Requirements 1.5**
  - [ ]* 7.4 编写提示词重置幂等性属性测试
    - **Property 4: Prompt Reset Idempotence**
    - **Validates: Requirements 2.6**

- [x] 8. Checkpoint - 服务层和状态管理完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 9. 实现标准化服务
  - [x] 9.1 创建 `src/services/wechatStandardizationService.ts` 标准化服务
    - 实现 generateBanner 函数（AI 生成 + 处理）
    - 实现 generateCover 函数（AI 生成 + 背景移除 + 处理）
    - 实现 generateIcon 函数（AI 生成 + 背景移除 + 处理）
    - 实现 generateAll 函数（批量生成）
    - _Requirements: 3.1-3.7_
  - [ ]* 9.2 编写输出格式合规属性测试
    - **Property 7: Output Format Compliance**
    - **Validates: Requirements 4.6, 4.7, 4.8**

- [x] 10. 实现 UI 组件 - 图片上传
  - [x] 10.1 创建 `src/components/StandardizationImageUploader.tsx`
    - 实现拖拽上传区域
    - 实现点击上传功能
    - 实现图片预览列表
    - 实现删除功能
    - 实现数量限制提示
    - _Requirements: 1.1-1.7_

- [x] 11. 实现 UI 组件 - 提示词编辑
  - [x] 11.1 创建 `src/components/StandardizationPromptEditor.tsx`
    - 实现三组提示词编辑区域（P1/P2/P3）
    - 实现重置按钮
    - 实现实时保存
    - _Requirements: 2.1-2.6_

- [x] 12. 实现 UI 组件 - 预览面板
  - [x] 12.1 创建 `src/components/StandardizationPreviewPanel.tsx`
    - 实现 P1/P2/P3 预览卡片
    - 实现棋盘格透明背景展示
    - 实现重新生成按钮
    - 实现处理状态指示器
    - _Requirements: 3.5, 3.7, 5.6, 6.1, 6.2_

- [x] 13. 实现 UI 组件 - 下载面板
  - [x] 13.1 创建 `src/components/StandardizationDownloadPanel.tsx`
    - 实现单张下载按钮
    - 实现批量下载按钮
    - 显示文件信息（尺寸、大小）
    - _Requirements: 6.3, 6.4_

- [x] 14. 实现主面板组件
  - [x] 14.1 创建 `src/components/WeChatStandardizationPanel.tsx`
    - 整合所有子组件
    - 实现工作流布局
    - 实现从表情包模块导入功能
    - _Requirements: 7.1-7.4_

- [x] 15. 集成到主应用
  - [x] 15.1 更新 `src/components/WorkPanel.tsx`
    - 添加标准化模块入口按钮
    - 实现模块切换逻辑
    - _Requirements: 7.2_
  - [x] 15.2 更新 `src/components/index.ts` 导出新组件
  - [x] 15.3 更新 `src/services/index.ts` 导出新服务
  - [x] 15.4 更新 `src/types/index.ts` 导出新类型

- [x] 16. Final Checkpoint - 功能完成
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选测试任务，可跳过以加快 MVP 开发
- 每个属性测试需引用设计文档中的属性编号
- 使用 fast-check 进行属性测试，每个测试至少 100 次迭代
- 复用现有的 aiService、downloadService 等服务
- UI 组件样式与现有组件保持一致
