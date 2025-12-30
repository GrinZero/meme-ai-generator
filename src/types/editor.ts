/**
 * 编辑器相关类型定义
 */

export interface EditorState {
  selectedEmojiId: string | null;
  editPrompt: string;
  isEditing: boolean;
}
