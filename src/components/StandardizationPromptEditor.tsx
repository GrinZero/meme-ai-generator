/**
 * 微信表情标准化提示词编辑组件
 * 
 * 功能：
 * - 五组提示词编辑区域（P1-P5）
 * - 每组可选启用/禁用
 * - 重置按钮
 * - 实时保存
 * 
 * Requirements: 2.1-2.6
 */

import { useCallback, useState } from 'react';
import type { StandardizationPromptEditorProps, EnabledTypes } from '../types/wechatStandardization';
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
  {
    type: 'appreciationGuide' as const,
    label: 'P4 赞赏引导图',
    spec: WECHAT_SPECS.APPRECIATION_GUIDE,
    description: '吸引用户赞赏，画面有感染力，风格一致',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: 'appreciationThanks' as const,
    label: 'P5 赞赏致谢图',
    spec: WECHAT_SPECS.APPRECIATION_THANKS,
    description: '感谢用户赞赏，传达谢意，风格一致',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
];

/**
 * 单个提示词编辑区域
 */
interface PromptEditorItemProps {
  type: keyof EnabledTypes;
  label: string;
  description: string;
  spec: {
    width: number;
    height: number;
    displayName: string;
  };
  icon: React.ReactNode;
  value: string;
  isEnabled: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  onToggleEnabled: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function PromptEditorItem({
  type,
  label,
  description,
  spec,
  icon,
  value,
  isEnabled,
  onChange,
  onReset,
  onToggleEnabled,
  isExpanded,
  onToggleExpand,
}: PromptEditorItemProps) {
  const defaultPrompt = DEFAULT_PROMPTS[type];
  const isModified = value !== defaultPrompt;

  // 处理 Checkbox 点击，避免冒泡触发展开
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleEnabled();
  };

  return (
    <div className={`
      border rounded-lg overflow-hidden transition-colors
      ${isEnabled 
        ? 'bg-[#1a1a1a]/50 border-white/[0.08]' 
        : 'bg-[#1a1a1a]/20 border-white/[0.04]'
      }
    `}>
      {/* 头部区域 */}
      <div 
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
        role="button"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Checkbox */}
          <div 
            onClick={handleCheckboxClick}
            className="flex-shrink-0 flex items-center justify-center w-6 h-6 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={() => {}} // 由 onClick 处理
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#07c160] 
                focus:ring-[#07c160]/50 focus:ring-offset-0 cursor-pointer"
            />
          </div>

          <span className={`flex-shrink-0 ${isEnabled ? 'text-white/50' : 'text-white/20'}`}>
            {icon}
          </span>
          
          <div className={`text-left flex-1 min-w-0 transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-50'}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/80 truncate">{label}</span>
              <span className="text-xs text-white/30 flex-shrink-0">
                {spec.width}×{spec.height}
              </span>
              {isModified && isEnabled && (
                <span className="px-1.5 py-0.5 text-[10px] bg-[#646cff]/20 text-[#646cff] rounded flex-shrink-0">
                  已修改
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 mt-0.5 truncate">{description}</p>
          </div>
        </div>

        {isEnabled && (
          <svg
            className={`w-4 h-4 text-white/40 transition-transform duration-200 ml-3 flex-shrink-0 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* 展开内容 */}
      {isExpanded && isEnabled && (
        <div className="p-3 pt-0 space-y-3 border-t border-white/[0.04] mt-1">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`输入 ${label} 的生成提示词...`}
            className="
              w-full h-32 px-3 py-2 text-sm mt-3
              bg-[#0d0d0d] border border-white/[0.08] rounded-lg
              text-white/90 placeholder-white/30
              focus:outline-none focus:border-[#646cff]/50 focus:ring-1 focus:ring-[#646cff]/30
              resize-none transition-colors
            "
            onClick={(e) => e.stopPropagation()} // 防止点击输入框触发收起
          />
          
          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30">
              {value.length} 字符
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              disabled={!isModified}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md
                transition-all duration-200
                ${isModified
                  ? 'text-white/60 hover:text-white/80 hover:bg-white/[0.05] cursor-pointer'
                  : 'text-white/20 cursor-not-allowed'
                }
              `}
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
 */
export function StandardizationPromptEditor({
  prompts,
  enabledTypes,
  onPromptChange,
  onReset,
  onToggleType,
}: StandardizationPromptEditorProps) {
  // 默认展开第一个启用的项目
  const [expandedType, setExpandedType] = useState<keyof EnabledTypes | null>('p1');

  const handleToggleExpand = useCallback((type: keyof EnabledTypes) => {
    // 只有启用的项目才能展开
    if (enabledTypes[type]) {
      setExpandedType((prev) => (prev === type ? null : type));
    }
  }, [enabledTypes]);

  // 检查是否有任何已启用的提示词被修改
  const hasAnyModification = PROMPT_CONFIGS.some(config => 
    enabledTypes[config.type] && prompts[config.type] !== DEFAULT_PROMPTS[config.type]
  );

  const handleResetAll = useCallback(() => {
    PROMPT_CONFIGS.forEach(config => {
      if (enabledTypes[config.type]) {
        onReset(config.type);
      }
    });
  }, [enabledTypes, onReset]);

  return (
    <div className="space-y-4">
      {/* 标题和全部重置按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white/70">生成设置</h3>
          <span className="text-xs text-white/30">
            (勾选需要生成的图片类型)
          </span>
        </div>
        
        {hasAnyModification && (
          <button
            onClick={handleResetAll}
            className="
              flex items-center gap-1.5 px-2 py-1 text-xs
              text-white/50 hover:text-white/70
              hover:bg-white/[0.05] rounded-md
              transition-all duration-200
            "
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
            value={prompts[config.type]}
            isEnabled={enabledTypes[config.type]}
            onChange={(value) => onPromptChange(config.type, value)}
            onReset={() => onReset(config.type)}
            onToggleEnabled={() => onToggleType(config.type)}
            isExpanded={expandedType === config.type}
            onToggleExpand={() => handleToggleExpand(config.type)}
          />
        ))}
      </div>
    </div>
  );
}

export default StandardizationPromptEditor;