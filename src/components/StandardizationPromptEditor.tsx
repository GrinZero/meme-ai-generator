/**
 * 微信表情标准化提示词编辑组件
 * 
 * 功能：
 * - 三组提示词编辑区域（P1/P2/P3）
 * - 重置按钮
 * - 实时保存
 * 
 * Requirements: 2.1-2.6
 */

import { useCallback, useState } from 'react';
import type { StandardizationPromptEditorProps } from '../types/wechatStandardization';
import { WECHAT_SPECS, DEFAULT_PROMPTS } from '../services/wechatConstants';

/**
 * 提示词类型配置
 */
const PROMPT_CONFIGS = [
  {
    type: 'p1' as const,
    label: 'P1 详情页横幅',
    spec: WECHAT_SPECS.BANNER,
    description: '横幅构图，画面丰富有故事性，色调活泼明朗',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    type: 'p2' as const,
    label: 'P2 表情封面图',
    spec: WECHAT_SPECS.COVER,
    description: '正面半身像或全身像，简洁画面，高辨识度',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: 'p3' as const,
    label: 'P3 聊天页图标',
    spec: WECHAT_SPECS.ICON,
    description: '头部正面图像，简洁清晰，高辨识度',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

/**
 * 单个提示词编辑区域
 */
interface PromptEditorItemProps {
  type: 'p1' | 'p2' | 'p3';
  label: string;
  description: string;
  spec: {
    width: number;
    height: number;
    displayName: string;
  };
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function PromptEditorItem({
  type,
  label,
  description,
  spec,
  icon,
  value,
  onChange,
  onReset,
  isExpanded,
  onToggle,
}: PromptEditorItemProps) {
  const defaultPrompt = DEFAULT_PROMPTS[type];
  const isModified = value !== defaultPrompt;

  return (
    <div className="border border-white/[0.08] rounded-lg overflow-hidden bg-[#1a1a1a]/50">
      {/* 折叠头部 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`prompt-editor-${type}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-white/50">{icon}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/80">{label}</span>
              <span className="text-xs text-white/30">
                {spec.width}×{spec.height}
              </span>
              {isModified && (
                <span className="px-1.5 py-0.5 text-[10px] bg-[#646cff]/20 text-[#646cff] rounded">
                  已修改
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 mt-0.5">{description}</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-white/40 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div id={`prompt-editor-${type}`} className="p-3 pt-0 space-y-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`输入 ${label} 的生成提示词...`}
            className="
              w-full h-32 px-3 py-2 text-sm
              bg-[#0d0d0d] border border-white/[0.08] rounded-lg
              text-white/90 placeholder-white/30
              focus:outline-none focus:border-[#646cff]/50 focus:ring-1 focus:ring-[#646cff]/30
              resize-none transition-colors
            "
            aria-label={`${label}提示词`}
          />
          
          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30">
              {value.length} 字符
            </span>
            <button
              onClick={onReset}
              disabled={!isModified}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md
                transition-all duration-200
                ${isModified
                  ? 'text-white/60 hover:text-white/80 hover:bg-white/[0.05] cursor-pointer'
                  : 'text-white/20 cursor-not-allowed'
                }
              `}
              aria-label={`重置 ${label} 提示词`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              重置
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 微信表情标准化提示词编辑组件
 * 
 * @param p1Prompt - P1 提示词
 * @param p2Prompt - P2 提示词
 * @param p3Prompt - P3 提示词
 * @param onPromptChange - 提示词变更回调
 * @param onReset - 重置回调
 */
export function StandardizationPromptEditor({
  p1Prompt,
  p2Prompt,
  p3Prompt,
  onPromptChange,
  onReset,
}: StandardizationPromptEditorProps) {
  // 默认展开第一个
  const [expandedType, setExpandedType] = useState<'p1' | 'p2' | 'p3' | null>('p1');

  const getPromptValue = useCallback(
    (type: 'p1' | 'p2' | 'p3') => {
      switch (type) {
        case 'p1':
          return p1Prompt;
        case 'p2':
          return p2Prompt;
        case 'p3':
          return p3Prompt;
      }
    },
    [p1Prompt, p2Prompt, p3Prompt]
  );

  const handleToggle = useCallback((type: 'p1' | 'p2' | 'p3') => {
    setExpandedType((prev) => (prev === type ? null : type));
  }, []);

  // 检查是否有任何提示词被修改
  const hasAnyModification =
    p1Prompt !== DEFAULT_PROMPTS.p1 ||
    p2Prompt !== DEFAULT_PROMPTS.p2 ||
    p3Prompt !== DEFAULT_PROMPTS.p3;

  const handleResetAll = useCallback(() => {
    onReset('p1');
    onReset('p2');
    onReset('p3');
  }, [onReset]);

  return (
    <div className="space-y-4">
      {/* 标题和全部重置按钮 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">生成提示词</h3>
        {hasAnyModification && (
          <button
            onClick={handleResetAll}
            className="
              flex items-center gap-1.5 px-2 py-1 text-xs
              text-white/50 hover:text-white/70
              hover:bg-white/[0.05] rounded-md
              transition-all duration-200
            "
            aria-label="重置所有提示词"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            全部重置
          </button>
        )}
      </div>

      {/* 提示词编辑区域列表 */}
      <div className="space-y-2">
        {PROMPT_CONFIGS.map((config) => (
          <PromptEditorItem
            key={config.type}
            type={config.type}
            label={config.label}
            description={config.description}
            spec={config.spec}
            icon={config.icon}
            value={getPromptValue(config.type)}
            onChange={(value) => onPromptChange(config.type, value)}
            onReset={() => onReset(config.type)}
            isExpanded={expandedType === config.type}
            onToggle={() => handleToggle(config.type)}
          />
        ))}
      </div>

      {/* 提示信息 */}
      <p className="text-xs text-white/30 text-center">
        提示词将用于 AI 生成对应类型的基础图例，修改后自动保存
      </p>
    </div>
  );
}

export default StandardizationPromptEditor;
