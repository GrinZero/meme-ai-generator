# Implementation Plan: Dynamic Model List

## Overview

实现动态模型列表获取功能，当用户配置 API Key 和 API 风格后，自动从对应 API 获取可用模型列表。

## Tasks

- [x] 1. 创建模型列表服务
  - [x] 1.1 创建 modelListService.ts 基础结构
    - 定义 ModelInfo 和 FetchModelsResult 接口
    - 实现缓存数据结构和 TTL 逻辑
    - 定义默认模型列表常量
    - _Requirements: 1.7, 4.5_

  - [x] 1.2 实现 Gemini 模型列表获取
    - 构建 Gemini models.list API 端点 URL
    - 发送请求并解析响应
    - 过滤支持 generateContent 的模型
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 实现 OpenAI 风格模型列表获取
    - 构建 /v1/models API 端点 URL
    - 发送请求并解析响应
    - 处理分页（如果有）
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.4 编写 URL 构建属性测试
    - **Property 5: URL Construction**
    - **Validates: Requirements 2.3, 3.3**

  - [x] 1.5 编写 Gemini 模型过滤属性测试
    - **Property 6: Gemini Model Filtering**
    - **Validates: Requirements 2.2**

- [x] 2. 扩展 Store 状态
  - [x] 2.1 添加模型列表相关状态
    - 添加 availableModels、isLoadingModels、modelListError 状态
    - 添加对应的 setter actions
    - 添加 fetchModelList action
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 编写缓存行为属性测试
    - **Property 4: Cache Prevents Duplicate Requests**
    - **Validates: Requirements 1.7**

- [x] 3. Checkpoint - 服务层完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 更新 ConfigPanel 组件
  - [x] 4.1 集成动态模型列表
    - 使用 store 中的 availableModels 替代硬编码列表
    - 添加加载状态指示器
    - 添加错误提示显示
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 4.2 实现配置变更触发获取
    - API Key 变更时触发获取（防抖 500ms）
    - API 风格变更时触发获取
    - Base URL 变更时触发获取（防抖 500ms）
    - _Requirements: 1.5, 1.6, 1.8_

  - [x] 4.3 实现模型选择保持逻辑
    - 模型列表更新后保持之前选择的模型（如果存在）
    - 如果之前的模型不存在，选择第一个
    - _Requirements: 4.2, 4.3_

  - [x] 4.4 添加手动刷新按钮
    - 在模型下拉框旁添加刷新图标按钮
    - 点击时清除缓存并重新获取
    - _Requirements: 4.4_

  - [x] 4.5 编写模型选择保持属性测试
    - **Property 7: Model Selection Preservation**
    - **Validates: Requirements 4.2, 4.3**

- [x] 5. 实现错误处理
  - [x] 5.1 添加获取失败回退逻辑
    - 获取失败时使用默认模型列表
    - 显示用户友好的错误信息
    - _Requirements: 1.4_

  - [x] 5.2 编写获取失败回退属性测试
    - **Property 3: Fetch Failure Fallback**
    - **Validates: Requirements 1.4**

- [x] 6. Final Checkpoint - 功能完成
  - 确保所有测试通过
  - 验证完整用户流程：填写 API Key → 选择风格 → 自动获取模型列表
  - 如有问题请询问用户

## Notes

- 所有任务均为必做任务，包括属性测试
- 使用 fast-check 进行属性测试
- 防抖使用 500ms 延迟，避免频繁请求
- 缓存 TTL 为 5 分钟

