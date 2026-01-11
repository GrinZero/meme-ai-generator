# Requirements Document

## Introduction

微信表情标准化功能增强，包含四个主要改进：
1. AI 生成大图增加保存按钮，方便用户直接保存生成的原始大图
2. 微信标准化增加赞赏图生成选项，支持生成赞赏引导图（750×560）和赞赏致谢图（750×750）
3. 优化表情封面图（P2）和聊天页图标（P3）的提示词，避免生成 9×9 拼接式无意义图片
4. 重新设计微信标准化页面布局，移除右侧提取表情区，增加从已生成图片中选择并单独处理的功能

## Glossary

- **Generated_Image**: AI 生成的原始大图
- **Save_Button**: 保存按钮组件，用于下载生成的大图
- **Appreciation_Guide_Image**: 赞赏引导图，展示在选择赞赏金额页面，750×560像素
- **Appreciation_Thanks_Image**: 赞赏致谢图，展示在答谢页面，750×750像素
- **P2_Cover**: 表情封面图，240×240像素，需要单个角色的半身像或全身像
- **P3_Icon**: 聊天页图标，50×50像素，需要单个角色的头部正面图
- **Preview_Gallery**: 预览图库，展示已生成的 P1/P2/P3 图片供用户选择
- **Image_Reprocessor**: 图片再处理服务，对选中的图片进行单独处理

## Requirements

### Requirement 1: AI 生成大图保存功能

**User Story:** 作为用户，我希望能够直接保存 AI 生成的原始大图，以便在其他场景中使用或备份。

#### Acceptance Criteria

1. WHEN AI 生成完成且有生成结果 THEN THE Save_Button SHALL 显示在生成结果预览区域
2. WHEN 用户点击保存按钮 THEN THE System SHALL 将生成的原始大图下载到本地
3. THE Save_Button SHALL 使用清晰的图标和文字标识"保存原图"
4. WHEN 下载时 THEN THE System SHALL 使用有意义的文件名（如 emoji_generated_时间戳.png）
5. IF 生成结果不存在 THEN THE Save_Button SHALL 不显示或禁用

### Requirement 2: 赞赏图生成选项

**User Story:** 作为用户，我希望能够选择是否生成微信表情赞赏相关图片，以便完整提交表情包到微信平台。

#### Acceptance Criteria

1. THE Standardization_Module SHALL 提供"生成赞赏图"复选框选项
2. WHEN 用户勾选"生成赞赏图"选项 THEN THE System SHALL 显示赞赏引导图和赞赏致谢图的配置区域
3. THE Appreciation_Guide_Image SHALL 符合微信规范：JPG/GIF/PNG格式，750×560像素，≤500KB
4. THE Appreciation_Thanks_Image SHALL 符合微信规范：JPG/GIF/PNG格式，750×750像素，≤500KB
5. THE System SHALL 为赞赏引导图提供默认提示词，强调吸引用户赞赏、风格与表情一致
6. THE System SHALL 为赞赏致谢图提供默认提示词，强调激发分享意愿、风格与表情一致
7. WHEN 用户修改赞赏图提示词 THEN THE Prompt_Editor SHALL 实时保存修改内容
8. WHEN 用户点击重置按钮 THEN THE Prompt_Editor SHALL 恢复对应类型的默认提示词
9. WHEN 生成赞赏图时 THEN THE System SHALL 确保图片风格与表情一致，不出现与表情不相关的内容
10. WHEN 下载时 THEN THE System SHALL 将赞赏图包含在 ZIP 包中（如果已生成）

### Requirement 3: 优化 P1/P2/P3 提示词

**User Story:** 作为用户，我希望生成的微信标准化图片更加生动有趣，表情封面图和聊天页图标是单个角色的清晰形象，而不是多个表情的拼接图。

#### Acceptance Criteria

1. THE P1_Banner 默认提示词 SHALL 更加大胆有创意，避免生成死板的横幅图
2. THE P1_Banner 默认提示词 SHALL 强调画面生动活泼、有故事性、有趣味性
3. THE P1_Banner 默认提示词 SHALL 鼓励创意构图，如角色互动、有趣场景、动态姿势等
4. THE P2_Cover 默认提示词 SHALL 明确要求生成单个角色的半身像或全身像
5. THE P2_Cover 默认提示词 SHALL 明确禁止生成多个表情拼接或 9 宫格形式
6. THE P2_Cover 默认提示词 SHALL 强调选取最具辨识度的单一形象
7. THE P3_Icon 默认提示词 SHALL 明确要求生成单个角色的头部正面图
8. THE P3_Icon 默认提示词 SHALL 明确禁止生成多个表情拼接或网格形式
9. THE P3_Icon 默认提示词 SHALL 强调画面简洁、高辨识度、无装饰元素
10. THE P2_Cover 默认提示词 SHALL 参考微信官方规范：使用表情形象正面的半身像或全身像，避免只使用头部
11. THE P3_Icon 默认提示词 SHALL 参考微信官方规范：使用仅含表情角色头部正面图像

### Requirement 4: 微信标准化页面布局重设计

**User Story:** 作为用户，我希望微信标准化页面更加简洁，并能够从已生成的图片中选择进行单独处理和替换。

#### Acceptance Criteria

1. THE Standardization_Module SHALL 移除右侧"提取的表情"区域
2. THE Standardization_Module SHALL 在左侧显示已生成的 P1/P2/P3/赞赏图预览
3. WHEN 用户点击已生成的预览图 THEN THE System SHALL 允许选中该图片
4. WHEN 图片被选中 THEN THE System SHALL 在右侧显示单独处理面板
5. THE 单独处理面板 SHALL 包含：独立的提示词编辑区、切割算法参数配置
6. WHEN 用户在单独处理面板修改提示词 THEN THE System SHALL 仅影响当前选中图片的重新生成
7. WHEN 用户点击"重新生成"按钮 THEN THE System SHALL 使用新的提示词重新生成选中类型的图片
8. WHEN 重新生成完成 THEN THE System SHALL 显示新旧图片对比
9. WHEN 用户点击"替换"按钮 THEN THE System SHALL 用新图片替换原有图片
10. WHEN 用户点击"取消"按钮 THEN THE System SHALL 保留原有图片，丢弃新生成的图片
11. THE 切割算法参数 SHALL 包含：容差值、最小区域、最小尺寸等可调参数
12. WHEN 用户调整切割参数后点击"应用" THEN THE System SHALL 使用新参数重新处理图片

