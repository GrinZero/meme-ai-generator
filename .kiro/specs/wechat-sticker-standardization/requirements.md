# Requirements Document

## Introduction

微信表情平台标准化功能，用于将用户上传的表情包图片（包括前置步骤生成的表情包集合、截图等）转换为符合微信表情开放平台规范的三种标准图片格式：详情页横幅(P1)、表情封面图(P2)、聊天页图标(P3)。该功能支持 AI 辅助生成基础图例，并通过传统图像处理算法完成尺寸调整和背景透明化处理。

## Glossary

- **Standardization_Module**: 微信表情标准化模块，负责协调整个标准化流程
- **Image_Uploader**: 图片上传组件，支持多图上传
- **Prompt_Editor**: 提示词编辑器，提供默认提示词并允许用户修改
- **AI_Generator**: AI 图片生成服务，调用 AI API 生成基础图例
- **Image_Processor**: 图像处理服务，负责尺寸调整和格式转换
- **Background_Remover**: 背景移除服务，使用抠图算法将图片背景透明化
- **P1_Banner**: 详情页横幅，750×400像素，JPG/PNG格式，不透明背景
- **P2_Cover**: 表情封面图，240×240像素，PNG格式，透明背景
- **P3_Icon**: 聊天页图标，50×50像素，PNG格式，透明背景
- **Source_Images**: 用户上传的源图片集合

## Requirements

### Requirement 1: 多图上传

**User Story:** 作为用户，我希望能够上传多张图片作为素材，以便系统可以基于这些素材生成微信表情平台所需的标准图片。

#### Acceptance Criteria

1. WHEN 用户进入标准化模块 THEN THE Image_Uploader SHALL 显示图片上传区域，支持拖拽和点击上传
2. WHEN 用户上传图片 THEN THE Image_Uploader SHALL 接受 PNG、JPG、JPEG、WebP 格式的图片
3. WHEN 用户上传多张图片 THEN THE Image_Uploader SHALL 支持同时上传最多 20 张图片
4. WHEN 图片上传成功 THEN THE Image_Uploader SHALL 显示图片缩略图预览列表
5. WHEN 用户点击已上传图片的删除按钮 THEN THE Image_Uploader SHALL 从列表中移除该图片
6. IF 用户上传的文件不是支持的图片格式 THEN THE Image_Uploader SHALL 显示格式错误提示并拒绝该文件
7. IF 用户上传的图片数量超过限制 THEN THE Image_Uploader SHALL 显示数量超限提示

### Requirement 2: 提示词配置

**User Story:** 作为用户，我希望能够查看和修改 AI 生成图片的提示词，以便更好地控制生成结果的风格和内容。

#### Acceptance Criteria

1. WHEN 标准化模块加载完成 THEN THE Prompt_Editor SHALL 显示三组默认提示词，分别对应 P1、P2、P3
2. THE Prompt_Editor SHALL 为 P1_Banner 提供默认提示词，强调横幅构图、故事性、活泼色调
3. THE Prompt_Editor SHALL 为 P2_Cover 提供默认提示词，强调正面半身像、简洁画面、高辨识度
4. THE Prompt_Editor SHALL 为 P3_Icon 提供默认提示词，强调头部正面图、简洁清晰、高辨识度
5. WHEN 用户修改提示词 THEN THE Prompt_Editor SHALL 实时保存修改内容
6. WHEN 用户点击重置按钮 THEN THE Prompt_Editor SHALL 恢复对应类型的默认提示词

### Requirement 3: AI 图片生成

**User Story:** 作为用户，我希望系统能够使用 AI 根据我上传的素材和提示词生成 P1、P2、P3 的基础图例，以便后续处理。

#### Acceptance Criteria

1. WHEN 用户点击生成按钮且已上传至少一张图片 THEN THE AI_Generator SHALL 开始生成流程
2. WHEN 生成 P1_Banner 时 THEN THE AI_Generator SHALL 使用 P1 提示词和源图片调用 AI API 生成横幅图
3. WHEN 生成 P2_Cover 时 THEN THE AI_Generator SHALL 使用 P2 提示词和源图片调用 AI API 生成封面图
4. WHEN 生成 P3_Icon 时 THEN THE AI_Generator SHALL 使用 P3 提示词和源图片调用 AI API 生成图标图
5. WHILE AI 生成进行中 THEN THE Standardization_Module SHALL 显示生成进度指示器
6. IF AI 生成失败 THEN THE AI_Generator SHALL 返回错误信息并允许用户重试
7. WHEN AI 生成完成 THEN THE Standardization_Module SHALL 显示三张生成的基础图例预览

### Requirement 4: 图片尺寸标准化

**User Story:** 作为用户，我希望系统能够将 AI 生成的基础图例处理成微信表情平台要求的标准尺寸，以便直接用于提交。

#### Acceptance Criteria

1. WHEN 处理 P1_Banner 时 THEN THE Image_Processor SHALL 将图片调整为 750×400 像素
2. WHEN 处理 P2_Cover 时 THEN THE Image_Processor SHALL 将图片调整为 240×240 像素
3. WHEN 处理 P3_Icon 时 THEN THE Image_Processor SHALL 将图片调整为 50×50 像素
4. WHEN 调整图片尺寸时 THEN THE Image_Processor SHALL 保持图片主体居中且不变形
5. WHEN 图片宽高比与目标不匹配时 THEN THE Image_Processor SHALL 使用智能裁剪保留主体内容
6. THE Image_Processor SHALL 输出 P1_Banner 为 JPG 或 PNG 格式
7. THE Image_Processor SHALL 输出 P2_Cover 为 PNG 格式
8. THE Image_Processor SHALL 输出 P3_Icon 为 PNG 格式

### Requirement 5: 背景透明化处理

**User Story:** 作为用户，我希望系统能够自动将 P2 封面图和 P3 图标的背景透明化，以符合微信表情平台的规范要求。

#### Acceptance Criteria

1. WHEN 处理 P2_Cover 时 THEN THE Background_Remover SHALL 使用抠图算法移除背景
2. WHEN 处理 P3_Icon 时 THEN THE Background_Remover SHALL 使用抠图算法移除背景
3. WHEN 背景移除完成 THEN THE Background_Remover SHALL 输出带透明通道的 PNG 图片
4. THE Background_Remover SHALL 保留图片主体的边缘清晰度，避免出现锯齿
5. THE Background_Remover SHALL 确保主体形象无白色描边残留
6. IF 抠图效果不理想 THEN THE Standardization_Module SHALL 允许用户手动调整或重新生成

### Requirement 6: 结果预览与导出

**User Story:** 作为用户，我希望能够预览标准化后的图片效果，并能够下载所有生成的标准图片。

#### Acceptance Criteria

1. WHEN 所有处理完成 THEN THE Standardization_Module SHALL 显示 P1、P2、P3 的最终预览
2. WHEN 显示 P2_Cover 和 P3_Icon 预览时 THEN THE Standardization_Module SHALL 使用棋盘格背景展示透明效果
3. WHEN 用户点击单张图片的下载按钮 THEN THE Standardization_Module SHALL 下载该图片
4. WHEN 用户点击批量下载按钮 THEN THE Standardization_Module SHALL 将 P1、P2、P3 打包为 ZIP 文件下载
5. THE Standardization_Module SHALL 使用规范的文件命名：banner_750x400、cover_240x240、icon_50x50
6. IF P1_Banner 文件大于 500KB THEN THE Image_Processor SHALL 自动压缩至 500KB 以内
7. IF P2_Cover 文件大于 500KB THEN THE Image_Processor SHALL 自动压缩至 500KB 以内
8. IF P3_Icon 文件大于 100KB THEN THE Image_Processor SHALL 自动压缩至 100KB 以内

### Requirement 7: 独立功能入口

**User Story:** 作为用户，我希望微信表情标准化功能有独立的入口，可以直接使用而不依赖前置的表情包生成流程。

#### Acceptance Criteria

1. THE Standardization_Module SHALL 作为独立功能模块存在于应用中
2. WHEN 用户从主界面进入标准化模块 THEN THE Standardization_Module SHALL 显示完整的标准化工作流界面
3. WHEN 用户已在表情包生成模块生成表情 THEN THE Standardization_Module SHALL 支持直接导入已生成的表情作为素材
4. THE Standardization_Module SHALL 支持用户从零开始上传新图片进行标准化处理
