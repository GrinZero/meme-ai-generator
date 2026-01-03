/**
 * 选区状态管理 Store
 * 管理手动框选切割功能的选区状态、操作历史和模式切换
 */

import { create } from 'zustand';
import type {
  SelectionRegion,
  SelectionMode,
  SelectionAction,
} from '../types/selection';

/**
 * 生成唯一的选区 ID
 */
const generateId = () => `sel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * 深拷贝选区数组
 */
function cloneSelections(selections: SelectionRegion[]): SelectionRegion[] {
  return selections.map((s) => ({
    ...s,
    boundingBox: { ...s.boundingBox },
    polygon: s.polygon
      ? { vertices: s.polygon.vertices.map((v) => ({ ...v })) }
      : undefined,
  }));
}

/**
 * 选区 Store 状态接口
 */
interface SelectionStoreState {
  /** 所有选区 */
  selections: SelectionRegion[];
  /** 当前活动选区 ID */
  activeSelectionId: string | null;
  /** 当前绘制模式 */
  mode: SelectionMode;
  /** 操作历史（用于撤销） */
  history: SelectionAction[];
  /** 历史指针 */
  historyIndex: number;
  /** 最大历史记录数 */
  maxHistorySize: number;
}

/**
 * 选区 Store 操作接口
 */
interface SelectionStoreActions {
  /** 添加选区 */
  addSelection: (selection: Omit<SelectionRegion, 'id' | 'createdAt'>) => string;
  /** 移除选区 */
  removeSelection: (id: string) => void;
  /** 更新选区 */
  updateSelection: (id: string, updates: Partial<SelectionRegion>) => void;
  /** 设置活动选区 */
  setActiveSelection: (id: string | null) => void;
  /** 切换选区选中状态（用于多选） */
  toggleSelectionSelected: (id: string, multiSelect?: boolean) => void;
  /** 设置绘制模式 */
  setMode: (mode: SelectionMode) => void;
  /** 撤销操作 */
  undo: () => void;
  /** 重做操作 */
  redo: () => void;
  /** 清空所有选区 */
  clearAll: () => void;
  /** 重置 Store 状态 */
  reset: () => void;
  /** 获取选区数量 */
  getSelectionCount: () => number;
  /** 检查是否可以撤销 */
  canUndo: () => boolean;
  /** 检查是否可以重做 */
  canRedo: () => boolean;
}

type SelectionStore = SelectionStoreState & SelectionStoreActions;

/**
 * 初始状态
 */
const initialState: SelectionStoreState = {
  selections: [],
  activeSelectionId: null,
  mode: 'rectangle',
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
};

/**
 * 选区状态管理 Store
 * 
 * Requirements:
 * - 4.1: 显示所有创建的选区列表
 * - 4.4: Delete 键删除活动选区
 * - 4.5: 提供"清空所有"按钮
 * - 7.4: 提供撤销按钮
 */
export const useSelectionStore = create<SelectionStore>((set, get) => ({
  ...initialState,

  /**
   * 添加选区
   * @param selection 选区数据（不含 id 和 createdAt）
   * @returns 新选区的 ID
   */
  addSelection: (selection) => {
    const id = generateId();
    const newSelection: SelectionRegion = {
      ...selection,
      id,
      createdAt: Date.now(),
      isSelected: false,
    };

    set((state) => {
      const previousState = cloneSelections(state.selections);
      const newSelections = [...state.selections, newSelection];

      // 记录历史
      const action: SelectionAction = {
        type: 'add',
        previousState,
        newState: cloneSelections(newSelections),
        timestamp: Date.now(),
      };

      // 截断历史（如果在中间位置）
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action);

      // 限制历史大小
      const trimmedHistory = newHistory.length > state.maxHistorySize
        ? newHistory.slice(newHistory.length - state.maxHistorySize)
        : newHistory;

      return {
        selections: newSelections,
        activeSelectionId: id,
        history: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
      };
    });

    return id;
  },

  /**
   * 移除选区
   * @param id 要移除的选区 ID
   */
  removeSelection: (id) => {
    set((state) => {
      const selectionExists = state.selections.some((s) => s.id === id);
      if (!selectionExists) {
        return state;
      }

      const previousState = cloneSelections(state.selections);
      const newSelections = state.selections.filter((s) => s.id !== id);

      // 记录历史
      const action: SelectionAction = {
        type: 'remove',
        previousState,
        newState: cloneSelections(newSelections),
        timestamp: Date.now(),
      };

      // 截断历史
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action);

      // 限制历史大小
      const trimmedHistory = newHistory.length > state.maxHistorySize
        ? newHistory.slice(newHistory.length - state.maxHistorySize)
        : newHistory;

      // 如果删除的是活动选区，清除活动状态
      const newActiveId = state.activeSelectionId === id ? null : state.activeSelectionId;

      return {
        selections: newSelections,
        activeSelectionId: newActiveId,
        history: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
      };
    });
  },

  /**
   * 更新选区
   * @param id 选区 ID
   * @param updates 要更新的属性
   */
  updateSelection: (id, updates) => {
    set((state) => {
      const selectionIndex = state.selections.findIndex((s) => s.id === id);
      if (selectionIndex === -1) {
        return state;
      }

      const previousState = cloneSelections(state.selections);
      const newSelections = state.selections.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );

      // 记录历史
      const action: SelectionAction = {
        type: 'modify',
        previousState,
        newState: cloneSelections(newSelections),
        timestamp: Date.now(),
      };

      // 截断历史
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action);

      // 限制历史大小
      const trimmedHistory = newHistory.length > state.maxHistorySize
        ? newHistory.slice(newHistory.length - state.maxHistorySize)
        : newHistory;

      return {
        selections: newSelections,
        history: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
      };
    });
  },

  /**
   * 设置活动选区
   * @param id 选区 ID，null 表示取消选择
   */
  setActiveSelection: (id) => {
    set({ activeSelectionId: id });
  },

  /**
   * 切换选区选中状态（用于 Shift+Click 多选）
   * @param id 选区 ID
   * @param multiSelect 是否为多选模式（Shift 键按下）
   */
  toggleSelectionSelected: (id, multiSelect = false) => {
    set((state) => {
      const newSelections = state.selections.map((s) => {
        if (s.id === id) {
          if (multiSelect) {
            // 多选模式：切换目标选区的选中状态
            return { ...s, isSelected: !s.isSelected };
          } else {
            // 非多选模式：始终选中目标选区
            return { ...s, isSelected: true };
          }
        } else if (!multiSelect) {
          // 非多选模式下，取消其他选区的选中状态
          return { ...s, isSelected: false };
        }
        return s;
      });

      return {
        selections: newSelections,
        activeSelectionId: id,
      };
    });
  },

  /**
   * 设置绘制模式
   * @param mode 绘制模式
   */
  setMode: (mode) => {
    set({ mode });
  },

  /**
   * 撤销操作
   */
  undo: () => {
    set((state) => {
      if (state.historyIndex < 0) {
        return state;
      }

      const action = state.history[state.historyIndex];
      return {
        selections: cloneSelections(action.previousState),
        historyIndex: state.historyIndex - 1,
        activeSelectionId: null,
      };
    });
  },

  /**
   * 重做操作
   */
  redo: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) {
        return state;
      }

      const nextIndex = state.historyIndex + 1;
      const action = state.history[nextIndex];
      return {
        selections: cloneSelections(action.newState),
        historyIndex: nextIndex,
        activeSelectionId: null,
      };
    });
  },

  /**
   * 清空所有选区
   */
  clearAll: () => {
    set((state) => {
      if (state.selections.length === 0) {
        return state;
      }

      const previousState = cloneSelections(state.selections);

      // 记录历史
      const action: SelectionAction = {
        type: 'clear',
        previousState,
        newState: [],
        timestamp: Date.now(),
      };

      // 截断历史
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action);

      // 限制历史大小
      const trimmedHistory = newHistory.length > state.maxHistorySize
        ? newHistory.slice(newHistory.length - state.maxHistorySize)
        : newHistory;

      return {
        selections: [],
        activeSelectionId: null,
        history: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
      };
    });
  },

  /**
   * 重置 Store 状态
   */
  reset: () => {
    set(initialState);
  },

  /**
   * 获取选区数量
   */
  getSelectionCount: () => {
    return get().selections.length;
  },

  /**
   * 检查是否可以撤销
   */
  canUndo: () => {
    return get().historyIndex >= 0;
  },

  /**
   * 检查是否可以重做
   */
  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },
}));
