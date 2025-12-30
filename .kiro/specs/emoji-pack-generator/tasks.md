# Implementation Plan: Emoji Pack Generator

## Overview

基于 React 18 + TypeScript + Vite 构建纯前端表情包生成应用。采用增量开发方式，先搭建基础架构，再逐步实现各功能模块。

## Tasks

- [x] 1. 项目初始化和基础架构
  - [x] 1.1 使用 Vite 创建 React + TypeScript 项目
    - 初始化项目结构
    - 配置 Tailwind CSS
    - 安装核心依赖：zustand, @imgly/background-removal, jszip
    - _Requirements: 项目基础设施_

  - [x] 1.2 创建类型定义文件
    - 定义 APIConfig, UploadedImage, ExtractedEmoji 等核心类型
    - 定义 AppState 状态接口
    - _Requirements: 1.1, 3.1, 6.1_

  - [x] 1.3 创建 Zustand Store 基础结构
    - 实现状态管理 store
    - 实现 localStorage 持久化中间件
    - _Requirements: 1.4, 1.5, 2.3_

  - [x] 1.4 编写 Config 持久化属性测试
    - **Property 1: Config Persistence Round Trip**
    - **Validates: Requirements 1.4, 1.5, 2.3**

- [x] 2. API 配置模块
  - [x] 2.1 实现 API 配置组件 (ConfigPanel)
    - API Key 输入框（密码类型）
    - Base URL 输入框
    - API 风格选择（Gemini/OpenAI）
    - 模型选择下拉框
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 实现配置验证逻辑
    - 验证 API Key 非空
    - 验证 Base URL 格式
    - 显示验证错误信息
    - _Requirements: 1.6_

  - [x] 2.3 编写配置验证属性测试
    - **Property 2: API Config Validation**
    - **Validates: Requirements 1.6**

  - [x] 2.4 实现语言偏好设置
    - 语言偏好输入框
    - 持久化到 localStorage
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Checkpoint - 配置模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 图片上传模块
  - [x] 4.1 实现图片上传组件 (ImageUploader)
    - 拖拽上传区域
    - 文件选择按钮
    - 图片预览网格
    - 删除按钮
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 4.2 实现上传限制和格式验证
    - 素材图最多 21 张限制
    - 基准图最多 3 张限制
    - 支持 PNG/JPG/JPEG/WebP 格式
    - 超出限制时显示错误提示
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 4.3 编写图片上传限制属性测试
    - **Property 4: Image Upload Limits**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 4.4 编写图片格式验证属性测试
    - **Property 6: Supported Image Formats**
    - **Validates: Requirements 3.6**

- [x] 5. 提示词构建模块
  - [x] 5.1 实现提示词构建组件 (PromptPanel)
    - 用户提示词输入区域
    - 示例提示词展示
    - 字符计数显示
    - _Requirements: 4.1, 4.4_

  - [x] 5.2 实现 PromptBuilder 服务
    - 系统提示词模板（纯色背景、网格排列、参考素材）
    - 组合系统提示词 + 语言偏好 + 用户提示词
    - _Requirements: 4.2, 4.3_

  - [x] 5.3 编写提示词组合属性测试
    - **Property 3: Prompt Composition**
    - **Validates: Requirements 2.2, 4.3**

- [x] 6. Checkpoint - 输入模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. AI 生成模块
  - [x] 7.1 实现 Gemini API 适配器
    - 使用 @google/generative-ai SDK
    - 支持图片输入
    - 处理流式响应
    - _Requirements: 5.1_

  - [x] 7.2 实现 OpenAI 风格 API 适配器
    - 使用 fetch 发送请求
    - 支持自定义 base URL
    - 处理图片 base64 编码
    - _Requirements: 5.1_

  - [x] 7.3 实现生成控制组件 (GeneratePanel)
    - 生成按钮
    - 加载状态指示器
    - 取消按钮
    - 生成结果预览
    - _Requirements: 5.2, 5.3, 5.5_

  - [x] 7.4 实现错误处理和用户提示
    - API 错误友好提示
    - 网络错误处理
    - 重试机制
    - _Requirements: 5.4_

  - [x] 7.5 编写错误消息属性测试
    - **Property 7: Error Message Display**
    - **Validates: Requirements 5.4**

- [x] 8. 图片分割模块
  - [x] 8.1 实现背景色检测算法
    - 采样四角像素
    - 计算主要背景色
    - 支持颜色容差设置
    - _Requirements: 6.1_

  - [x] 8.2 实现连通区域检测算法
    - 图片二值化处理
    - Flood Fill 标记连通区域
    - 提取每个区域的边界框
    - _Requirements: 6.1_

  - [x] 8.3 编写表情检测属性测试
    - **Property 8: Emoji Detection on Solid Background**
    - **Validates: Requirements 6.1**

  - [x] 8.4 实现单个表情裁剪和背景移除
    - 根据边界框裁剪图片
    - 使用 @imgly/background-removal 移除背景
    - 输出透明 PNG
    - _Requirements: 6.2, 6.3_

  - [x] 8.5 编写背景移除属性测试
    - **Property 9: Background Removal Transparency**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 8.6 实现分割结果预览组件 (EmojiGrid)
    - 网格展示所有提取的表情
    - 支持选择单个表情
    - 显示分割失败提示
    - _Requirements: 6.4, 6.5_

- [x] 9. Checkpoint - 核心功能完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 10. 表情编辑模块
  - [x] 10.1 实现表情编辑器组件 (EmojiEditor)
    - 显示选中的表情大图
    - 编辑提示词输入框
    - 重新生成按钮
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 10.2 实现单个表情重新生成逻辑
    - 调用 AI API 重新生成
    - 自动分割提取新表情
    - 替换原表情
    - _Requirements: 7.3, 7.4_

- [x] 11. 导出下载模块
  - [x] 11.1 实现单个表情下载功能
    - 生成透明 PNG Blob
    - 触发浏览器下载
    - 使用合适的文件名
    - _Requirements: 7.5, 8.1, 8.3_

  - [x] 11.2 实现批量打包下载功能
    - 使用 JSZip 打包所有表情
    - 生成 ZIP 文件
    - 触发下载
    - _Requirements: 8.2_

  - [x] 11.3 编写下载输出属性测试
    - **Property 10: Download Output Format**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 12. UI 整合和优化
  - [x] 12.1 实现主页面布局
    - 左侧：配置面板 + 上传面板
    - 中间：提示词面板 + 生成按钮
    - 右侧：结果预览 + 编辑器
    - _Requirements: 整体用户体验_

  - [x] 12.2 添加响应式设计
    - 移动端适配
    - 平板适配
    - _Requirements: 整体用户体验_

  - [x] 12.3 添加加载状态和过渡动画
    - 骨架屏加载
    - 平滑过渡效果
    - _Requirements: 整体用户体验_

- [x] 13. Final Checkpoint - 项目完成
  - 确保所有测试通过
  - 验证完整用户流程
  - 如有问题请询问用户

## Notes

- 所有任务均为必做任务，包括属性测试
- 每个属性测试引用设计文档中的对应属性编号
- Checkpoint 任务用于阶段性验证，确保增量开发的稳定性
- 使用 fast-check 库进行属性测试，每个测试至少运行 100 次迭代
