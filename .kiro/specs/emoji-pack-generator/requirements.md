# Requirements Document

## Introduction

这是一个纯前端的 AI 表情包生成应用。用户可以上传自己的图片（素材图和基准图），输入简短描述，AI 会根据这些信息一次性生成一系列表情包。生成后通过程序自动抠图分割，用户还可以对单个表情包进行二次编辑。

## Glossary

- **Emoji_Pack_Generator**: 表情包生成系统，负责整体应用逻辑
- **API_Config_Manager**: API 配置管理器，负责管理和存储用户的 API 配置
- **Image_Uploader**: 图片上传组件，负责处理素材图和基准图的上传
- **Prompt_Builder**: 提示词构建器，负责组合系统提示词和用户自定义提示词
- **AI_Generator**: AI 生成器，负责调用 AI API 生成表情包大图
- **Image_Splitter**: 图片分割器，负责将大图抠图分割成单个表情包
- **Emoji_Editor**: 表情包编辑器，负责对单个表情包进行二次编辑
- **Material_Image**: 素材图，用户上传的参考图片，最多 21 张
- **Reference_Image**: 基准图，用户希望最终生成的形象参考，最多 3 张

## Requirements

### Requirement 1: API 配置管理

**User Story:** As a user, I want to configure my AI API settings, so that I can use my own API key to generate emoji packs.

#### Acceptance Criteria

1. THE API_Config_Manager SHALL provide input fields for API Key, Base URL, and request style selection
2. THE API_Config_Manager SHALL support Gemini-style client as the default option
3. THE API_Config_Manager SHALL support OpenAI-style client as an alternative option
4. WHEN a user saves API configuration THEN THE API_Config_Manager SHALL persist the settings to browser local storage
5. WHEN the application loads THEN THE API_Config_Manager SHALL restore previously saved API configuration from local storage
6. WHEN a user modifies any API setting THEN THE API_Config_Manager SHALL validate the input format before saving

### Requirement 2: 语言偏好设置

**User Story:** As a user, I want to set my language preference for emoji text, so that the generated emoji packs have text in my preferred language.

#### Acceptance Criteria

1. THE Emoji_Pack_Generator SHALL provide a language preference input field
2. WHEN a user sets language preference (e.g., "配字必须是中文") THEN THE Prompt_Builder SHALL incorporate this preference into the generation prompt
3. THE API_Config_Manager SHALL persist language preference to browser local storage

### Requirement 3: 图片上传

**User Story:** As a user, I want to upload my images as references, so that the AI can generate emoji packs based on my materials.

#### Acceptance Criteria

1. THE Image_Uploader SHALL accept up to 21 Material_Images as reference materials
2. THE Image_Uploader SHALL accept up to 3 Reference_Images as target style references
3. WHEN a user uploads more than the allowed number of images THEN THE Image_Uploader SHALL reject the excess images and display an error message
4. THE Image_Uploader SHALL display preview thumbnails of all uploaded images
5. THE Image_Uploader SHALL allow users to remove individual uploaded images
6. THE Image_Uploader SHALL support common image formats (PNG, JPG, JPEG, WebP)

### Requirement 4: 提示词构建

**User Story:** As a user, I want to provide custom prompts to guide the AI generation, so that I can get emoji packs that match my specific requirements.

#### Acceptance Criteria

1. THE Prompt_Builder SHALL provide a text input area for user custom prompts
2. THE Prompt_Builder SHALL include system prompts that ensure:
   - Generated emoji packs have solid color backgrounds
   - AI generates multiple emojis in a single large image
   - Generated emojis reference the uploaded Material_Images and Reference_Images
3. WHEN generating the final prompt THEN THE Prompt_Builder SHALL combine system prompts, language preference, and user custom prompts
4. THE Prompt_Builder SHALL display example prompts to guide users (e.g., "这是我的小猫咪美长起司小猫咪，我希望表情包是 Q 版萌系的风格")

### Requirement 5: AI 表情包生成

**User Story:** As a user, I want to generate emoji packs using AI, so that I can create custom emojis based on my uploaded images.

#### Acceptance Criteria

1. WHEN a user clicks the generate button THEN THE AI_Generator SHALL send the prompt and images to the configured AI API
2. THE AI_Generator SHALL display a loading indicator during generation
3. WHEN generation completes successfully THEN THE AI_Generator SHALL display the generated large image
4. IF the AI API returns an error THEN THE AI_Generator SHALL display a user-friendly error message
5. THE AI_Generator SHALL support canceling an ongoing generation request

### Requirement 6: 图片分割抠图

**User Story:** As a user, I want the system to automatically split the generated large image into individual emojis, so that I can use them separately.

#### Acceptance Criteria

1. WHEN a large image is generated THEN THE Image_Splitter SHALL automatically detect and extract individual emojis
2. THE Image_Splitter SHALL remove the solid color background from each extracted emoji
3. THE Image_Splitter SHALL output each emoji as a separate image with transparent background
4. THE Image_Splitter SHALL display all extracted emojis in a preview grid
5. IF the Image_Splitter fails to detect emojis THEN THE Image_Splitter SHALL display an error message and allow manual retry

### Requirement 7: 单个表情包编辑

**User Story:** As a user, I want to edit individual emojis after extraction, so that I can customize them further.

#### Acceptance Criteria

1. WHEN a user selects an extracted emoji THEN THE Emoji_Editor SHALL display the emoji for editing
2. THE Emoji_Editor SHALL allow users to input a custom prompt for regenerating the selected emoji
3. THE Emoji_Editor SHALL ensure the regenerated emoji has a solid color background for easy extraction
4. WHEN regeneration completes THEN THE Image_Splitter SHALL extract the new emoji and replace the original
5. THE Emoji_Editor SHALL allow users to download individual emojis

### Requirement 8: 表情包导出

**User Story:** As a user, I want to download my generated emojis, so that I can use them in messaging apps.

#### Acceptance Criteria

1. THE Emoji_Pack_Generator SHALL allow users to download individual emojis as PNG files with transparent background
2. THE Emoji_Pack_Generator SHALL allow users to download all emojis as a ZIP archive
3. WHEN downloading THEN THE Emoji_Pack_Generator SHALL use appropriate file names for the emojis
