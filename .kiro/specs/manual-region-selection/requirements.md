# Requirements Document

## Introduction

本功能为表情包生成器引入一种新的切割模式——手动框选切割。用户可以直接在图片上绘制选区（矩形或自由多边形），系统将对选中区域进行提取、背景移除，并标准化为 240×240 像素的单个表情包。该功能解决了 AI 切割和算法切割在处理不规则图片时可能出现的切割不准确问题，让用户拥有完全的控制权。

## Glossary

- **Selection_Canvas**: 用于绘制和显示用户选区的交互式画布组件
- **Selection_Region**: 用户在图片上绘制的选区，可以是矩形或多边形
- **Region_Extractor**: 负责从原图中提取选区内容的服务模块
- **Background_Remover**: 负责移除提取区域背景的服务模块
- **Emoji_Normalizer**: 负责将提取的图片标准化为 240×240 像素的服务模块
- **Selection_Mode**: 当前的选区绘制模式，包括矩形模式和多边形模式
- **Selection_Tool_Panel**: 包含选区工具和操作按钮的控制面板

## Requirements

### Requirement 1: 选区画布初始化

**User Story:** As a user, I want to see an interactive canvas overlay on my uploaded image, so that I can draw selection regions directly on the image.

#### Acceptance Criteria

1. WHEN a user uploads an image for manual region selection, THE Selection_Canvas SHALL display the image with an interactive overlay layer
2. THE Selection_Canvas SHALL maintain the original image aspect ratio while fitting within the available viewport
3. THE Selection_Canvas SHALL support zoom and pan operations for precise selection on large images
4. WHEN the image is loaded, THE Selection_Canvas SHALL display visual guides (crosshairs or grid) to assist alignment

### Requirement 2: 矩形选区绘制

**User Story:** As a user, I want to draw rectangular selection regions on the image, so that I can quickly select emoji areas with straight edges.

#### Acceptance Criteria

1. WHEN the user is in rectangle mode and clicks and drags on the canvas, THE Selection_Canvas SHALL draw a rectangular selection region
2. WHILE the user is dragging, THE Selection_Canvas SHALL display a real-time preview of the rectangle with a semi-transparent fill and visible border
3. WHEN the user releases the mouse button, THE Selection_Canvas SHALL finalize the rectangle and add it to the selection list
4. THE Selection_Canvas SHALL allow the user to resize a completed rectangle by dragging its corner or edge handles
5. THE Selection_Canvas SHALL allow the user to move a completed rectangle by dragging its interior

### Requirement 3: 多边形选区绘制

**User Story:** As a user, I want to draw freeform polygon selection regions, so that I can precisely select irregularly shaped emoji areas.

#### Acceptance Criteria

1. WHEN the user is in polygon mode and clicks on the canvas, THE Selection_Canvas SHALL place a vertex point at the click location
2. WHILE the user is adding vertices, THE Selection_Canvas SHALL draw lines connecting consecutive vertices and show a preview line to the cursor
3. WHEN the user double-clicks or clicks near the starting vertex, THE Selection_Canvas SHALL close the polygon and add it to the selection list
4. THE Selection_Canvas SHALL allow the user to move individual vertices of a completed polygon by dragging them
5. THE Selection_Canvas SHALL allow the user to add new vertices to a completed polygon by clicking on its edges
6. IF the user attempts to create a self-intersecting polygon, THEN THE Selection_Canvas SHALL display a warning and prevent the invalid shape

### Requirement 4: 选区管理

**User Story:** As a user, I want to manage multiple selection regions, so that I can extract several emojis from a single image.

#### Acceptance Criteria

1. THE Selection_Tool_Panel SHALL display a list of all created selection regions with thumbnail previews
2. WHEN the user clicks on a selection in the list, THE Selection_Canvas SHALL highlight and focus on that selection
3. THE Selection_Tool_Panel SHALL provide a delete button for each selection region
4. WHEN the user presses the Delete key with a selection active, THE Selection_Canvas SHALL remove that selection
5. THE Selection_Tool_Panel SHALL provide a "Clear All" button to remove all selections at once
6. THE Selection_Canvas SHALL support selecting multiple regions simultaneously using Shift+Click

### Requirement 5: 选区提取与背景移除

**User Story:** As a user, I want to extract the content within my selections and have the background removed, so that I get clean emoji images.

#### Acceptance Criteria

1. WHEN the user clicks the "Extract" button, THE Region_Extractor SHALL crop the image content within each selection region
2. FOR polygon selections, THE Region_Extractor SHALL mask pixels outside the polygon boundary as transparent
3. WHEN extraction is complete, THE Background_Remover SHALL process each extracted region to remove background colors
4. THE Background_Remover SHALL use the flood-fill algorithm starting from edges to preserve internal similar colors
5. IF background removal fails for a region, THEN THE Region_Extractor SHALL return the original cropped image with a warning

### Requirement 6: 表情包标准化

**User Story:** As a user, I want my extracted emojis to be standardized to 240×240 pixels, so that they are consistent and ready for use.

#### Acceptance Criteria

1. WHEN an emoji is extracted, THE Emoji_Normalizer SHALL resize it to fit within a 240×240 pixel canvas while maintaining aspect ratio
2. THE Emoji_Normalizer SHALL center the resized emoji within the 240×240 canvas
3. THE Emoji_Normalizer SHALL fill any remaining space with transparency
4. THE Emoji_Normalizer SHALL use high-quality interpolation (bicubic or lanczos) for resizing to preserve image quality
5. WHEN the original region is smaller than 240×240, THE Emoji_Normalizer SHALL scale it up proportionally

### Requirement 7: 工具面板交互

**User Story:** As a user, I want a clear and intuitive tool panel, so that I can easily switch between selection modes and perform actions.

#### Acceptance Criteria

1. THE Selection_Tool_Panel SHALL display mode toggle buttons for rectangle and polygon selection modes
2. THE Selection_Tool_Panel SHALL visually indicate the currently active selection mode
3. THE Selection_Tool_Panel SHALL provide an "Extract All" button to process all selections
4. THE Selection_Tool_Panel SHALL provide an "Undo" button to revert the last selection action
5. WHEN no selections exist, THE Selection_Tool_Panel SHALL disable the "Extract All" and "Clear All" buttons
6. THE Selection_Tool_Panel SHALL display the count of current selections

### Requirement 8: 键盘快捷键支持

**User Story:** As a user, I want keyboard shortcuts for common actions, so that I can work more efficiently.

#### Acceptance Criteria

1. WHEN the user presses 'R' key, THE Selection_Canvas SHALL switch to rectangle selection mode
2. WHEN the user presses 'P' key, THE Selection_Canvas SHALL switch to polygon selection mode
3. WHEN the user presses 'Escape' key while drawing, THE Selection_Canvas SHALL cancel the current selection in progress
4. WHEN the user presses 'Ctrl+Z' (or 'Cmd+Z' on Mac), THE Selection_Canvas SHALL undo the last action
5. WHEN the user presses 'Delete' or 'Backspace' with a selection active, THE Selection_Canvas SHALL delete that selection

### Requirement 9: 视觉反馈与状态指示

**User Story:** As a user, I want clear visual feedback during selection operations, so that I understand what is happening.

#### Acceptance Criteria

1. WHILE a selection is being drawn, THE Selection_Canvas SHALL display dimension labels showing width and height in pixels
2. WHEN the cursor hovers over a selection handle, THE Selection_Canvas SHALL change the cursor to indicate the available action (resize, move, etc.)
3. WHEN extraction is in progress, THE Selection_Tool_Panel SHALL display a loading indicator with progress information
4. WHEN extraction completes successfully, THE Selection_Tool_Panel SHALL display a success message with the number of emojis extracted
5. IF an error occurs during extraction, THEN THE Selection_Tool_Panel SHALL display an error message with details

### Requirement 10: 与现有系统集成

**User Story:** As a user, I want the extracted emojis to appear in the existing emoji grid, so that I can edit and download them like other emojis.

#### Acceptance Criteria

1. WHEN emojis are extracted via manual selection, THE System SHALL add them to the existing extractedEmojis array in the store
2. THE extracted emojis SHALL have the same data structure (id, blob, preview, boundingBox) as emojis from other extraction methods
3. WHEN manual selection extraction completes, THE System SHALL automatically switch to the emoji grid view
4. THE user SHALL be able to use all existing emoji editing features (regenerate, delete, download) on manually extracted emojis
