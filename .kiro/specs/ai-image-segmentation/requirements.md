# Requirements Document

## Introduction

本功能旨在使用 AI 视觉模型来识别和分割表情包图片中的各个表情区域，替代现有的基于连通区域检测的算法。AI 可以返回多边形轮廓坐标，支持不规则形状的表情包提取，提高切割的准确性和稳定性。

## Glossary

- **AI_Segmentation_Service**: 负责调用 AI 视觉模型进行图像分割的服务模块
- **Polygon**: 由一系列顶点坐标组成的多边形，用于描述表情包的轮廓
- **Segmentation_Result**: AI 返回的分割结果，包含多个表情区域的轮廓信息
- **Vision_Model**: 支持图像理解的 AI 模型（如 Gemini、GPT-4o）
- **Contour**: 表情包的边界轮廓，可以是矩形或多边形

## Requirements

### Requirement 1: AI 分割请求

**User Story:** As a user, I want the system to send images to AI for segmentation, so that I can get accurate emoji boundaries without relying on unstable algorithms.

#### Acceptance Criteria

1. WHEN a user triggers AI segmentation, THE AI_Segmentation_Service SHALL send the image to the configured Vision_Model with a structured prompt
2. WHEN sending the segmentation request, THE AI_Segmentation_Service SHALL include instructions for the AI to return JSON-formatted coordinates
3. IF the API request fails, THEN THE AI_Segmentation_Service SHALL return a descriptive error message
4. WHEN the image is larger than 4MB, THE AI_Segmentation_Service SHALL compress the image before sending

### Requirement 2: 多边形轮廓支持

**User Story:** As a user, I want the system to support polygon contours, so that I can extract irregularly shaped emojis accurately.

#### Acceptance Criteria

1. THE Segmentation_Result SHALL support both rectangular bounding boxes and polygon contours
2. WHEN AI returns polygon coordinates, THE AI_Segmentation_Service SHALL validate that each polygon has at least 3 vertices
3. WHEN AI returns rectangular coordinates, THE AI_Segmentation_Service SHALL convert them to the standard BoundingBox format
4. THE Polygon type SHALL store coordinates as an array of {x, y} points in clockwise or counter-clockwise order

### Requirement 3: AI 响应解析

**User Story:** As a developer, I want the system to parse AI responses reliably, so that the segmentation results can be used for image cropping.

#### Acceptance Criteria

1. WHEN AI returns a valid JSON response, THE AI_Segmentation_Service SHALL parse it into Segmentation_Result objects
2. IF AI returns malformed JSON, THEN THE AI_Segmentation_Service SHALL attempt to extract JSON from the response text
3. IF AI returns coordinates outside image bounds, THEN THE AI_Segmentation_Service SHALL clamp them to valid ranges
4. WHEN parsing is complete, THE AI_Segmentation_Service SHALL normalize coordinates to pixel values (handling percentage-based responses)

### Requirement 4: 多边形裁剪

**User Story:** As a user, I want the system to crop images using polygon contours, so that I can get precisely shaped emoji extractions.

#### Acceptance Criteria

1. WHEN a polygon contour is provided, THE Image_Cropper SHALL create a canvas with the polygon's bounding box dimensions
2. WHEN cropping with a polygon, THE Image_Cropper SHALL apply a clipping mask based on the polygon path
3. THE Image_Cropper SHALL preserve transparency for pixels outside the polygon boundary
4. WHEN the polygon is convex, THE Image_Cropper SHALL use optimized clipping for better performance

### Requirement 5: 回退机制

**User Story:** As a user, I want the system to fall back to traditional detection when AI fails, so that I can still extract emojis even without AI.

#### Acceptance Criteria

1. IF AI segmentation fails or times out, THEN THE System SHALL fall back to the existing connected-component detection algorithm
2. WHEN falling back, THE System SHALL notify the user that AI segmentation was unavailable
3. THE System SHALL allow users to manually choose between AI and traditional detection methods

### Requirement 6: Prompt 工程

**User Story:** As a developer, I want well-designed prompts for AI segmentation, so that the AI returns accurate and consistent results.

#### Acceptance Criteria

1. THE AI_Segmentation_Service SHALL use a structured prompt that requests JSON output with specific schema
2. THE prompt SHALL instruct the AI to identify all distinct emoji/sticker regions in the image
3. THE prompt SHALL specify the expected coordinate format (pixels or percentages)
4. THE prompt SHALL handle edge cases like overlapping emojis or emojis touching the image border
