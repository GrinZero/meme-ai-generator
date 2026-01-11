/**
 * 预览图库组件
 * 
 * 功能：
 * - 显示 P1/P2/P3/赞赏图的缩略图
 * - 支持点击选择图片
 * - 高亮显示选中的图片
 * 
 * Requirements: 4.2, 4.3
 */

import { useMemo, useState } from 'react';
import type { ProcessedImage, WImageType, EnabledTypes } from '../types/wechatStandardization';
import { WECHAT_SPECS } from '../services/wechatConstants';
import { ImageViewer } from './ImageViewer';

/**
 * 预览图库组件 Props
 */
export interface PreviewGalleryProps {
  /** P1 横幅预览 */
  banner: ProcessedImage | null;
  /** P2 封面预览 */
  cover: ProcessedImage | null;
  /** P3 图标预览 */
  icon: ProcessedImage | null;
  /** P4 赞赏引导图预览 */
  appreciationGuide: ProcessedImage | null;
  /** P5 赞赏致谢图预览 */
  appreciationThanks: ProcessedImage | null;
  /** 当前选中的图片类型 */
  selectedType: WImageType | null;
  /** 选择回调 */
  onSelect: (type: WImageType) => void;
  /** 启用的图片类型 */
  enabledTypes?: EnabledTypes;
}

/**
 * 预览项配置
 */
interface PreviewItemConfig {
  type: WImageType;
  label: string;
  spec: {
    readonly width: number;
    readonly height: number;
    readonly requiresTransparency: boolean;
  };
  icon: React.ReactNode;
}

/**
 * 基础预览项配置（P1/P2/P3）
 */
const BASE_PREVIEW_CONFIGS: PreviewItemConfig[] = [
  {
    type: 'banner',
    label: 'P1 横幅',
    spec: WECHAT_SPECS.BANNER,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    type: 'cover',
    label: 'P2 封面',
    spec: WECHAT_SPECS.COVER,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: 'icon',
    label: 'P3 图标',
    spec: WECHAT_SPECS.ICON,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

/**
 * 赞赏图预览项配置
 */
const APPRECIATION_PREVIEW_CONFIGS: PreviewItemConfig[] = [
  {
    type: 'appreciationGuide',
    label: 'P4 赞赏引导',
    spec: WECHAT_SPECS.APPRECIATION_GUIDE,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: 'appreciationThanks',
    label: 'P5 赞赏致谢',
    spec: WECHAT_SPECS.APPRECIATION_THANKS,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
];

/**
 * 棋盘格背景样式（用于展示透明效果）
 */
const checkerboardStyle = {
  backgroundImage: `
    linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
  `,
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
  backgroundColor: '#1a1a1a',
};

/**
 * 单个预览项组件
 */
interface PreviewItemProps {
  config: PreviewItemConfig;
  image: ProcessedImage | null;
  isSelected: boolean;
  onClick: () => void;
  onPreview: (url: string) => void;
}

function PreviewItem({ config, image, isSelected, onClick, onPreview }: PreviewItemProps) {
  const showCheckerboard = config.spec.requiresTransparency;

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (image) {
      onPreview(image.preview);
    }
  };

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        disabled={!image}
        className={`
          relative flex flex-col rounded-lg overflow-hidden transition-all duration-200 w-full
          border-2
          ${isSelected
            ? 'border-[#646cff] ring-2 ring-[#646cff]/30'
            : image
              ? 'border-white/[0.08] hover:border-white/20 cursor-pointer'
              : 'border-white/[0.05] cursor-not-allowed opacity-50'
          }
        `}
        aria-label={`选择 ${config.label}`}
        aria-pressed={isSelected}
      >
        {/* 预览区域 */}
        <div 
          className="relative w-full aspect-square"
          style={showCheckerboard ? checkerboardStyle : { backgroundColor: '#0d0d0d' }}
        >
          {image ? (
            <img
              src={image.preview}
              alt={config.label}
              className="absolute inset-0 w-full h-full object-contain p-1"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/20">{config.icon}</span>
            </div>
          )}

          {/* 选中指示器 */}
          {isSelected && (
            <div className="absolute top-1 left-1 w-5 h-5 bg-[#646cff] rounded-full flex items-center justify-center z-10">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* 标签 */}
        <div className={`
          w-full px-2 py-1.5 text-[10px] text-center truncate
          ${isSelected ? 'bg-[#646cff]/20 text-[#646cff]' : 'bg-white/[0.03] text-white/50'}
        `}>
          {config.label}
        </div>
      </button>

      {/* 放大按钮悬浮层 - 仅当有图片时显示 */}
      {image && (
        <button
          onClick={handlePreview}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 
                     opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 backdrop-blur-sm transform scale-90 group-hover:scale-100"
          title="查看大图"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * 预览图库组件
 * 
 * 显示已生成的 P1/P2/P3/赞赏图预览，支持点击选择
 */
export function PreviewGallery({
  banner,
  cover,
  icon,
  appreciationGuide,
  appreciationThanks,
  selectedType,
  onSelect,
  enabledTypes,
}: PreviewGalleryProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 获取图片映射
  const imageMap = useMemo(() => ({
    banner,
    cover,
    icon,
    appreciationGuide,
    appreciationThanks,
  }), [banner, cover, icon, appreciationGuide, appreciationThanks]);

  // 获取预览配置
  const previewConfigs = useMemo(() => {
    // 默认启用 P1, P2, P3，如果不传 enabledTypes
    const types = enabledTypes || {
      p1: true,
      p2: true,
      p3: true,
      appreciationGuide: false,
      appreciationThanks: false,
    };

    const configs: PreviewItemConfig[] = [];

    if (types.p1) configs.push(BASE_PREVIEW_CONFIGS[0]);
    if (types.p2) configs.push(BASE_PREVIEW_CONFIGS[1]);
    if (types.p3) configs.push(BASE_PREVIEW_CONFIGS[2]);
    if (types.appreciationGuide) configs.push(APPRECIATION_PREVIEW_CONFIGS[0]);
    if (types.appreciationThanks) configs.push(APPRECIATION_PREVIEW_CONFIGS[1]);

    return configs;
  }, [enabledTypes]);

  // 计算已生成数量
  const generatedCount = useMemo(() => {
    let count = 0;
    // 只统计已启用且已生成的图片
    const types = enabledTypes || {
      p1: true,
      p2: true,
      p3: true,
      appreciationGuide: false,
      appreciationThanks: false,
    };

    if (types.p1 && banner) count++;
    if (types.p2 && cover) count++;
    if (types.p3 && icon) count++;
    if (types.appreciationGuide && appreciationGuide) count++;
    if (types.appreciationThanks && appreciationThanks) count++;
    
    return count;
  }, [banner, cover, icon, appreciationGuide, appreciationThanks, enabledTypes]);

  const totalCount = useMemo(() => {
    const types = enabledTypes || {
      p1: true,
      p2: true,
      p3: true,
      appreciationGuide: false,
      appreciationThanks: false,
    };
    return Object.values(types).filter(Boolean).length;
  }, [enabledTypes]);

  return (
    <div className="space-y-3">
      {/* 标题和状态 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">已生成图片</h3>
        <span className={`text-xs ${generatedCount === totalCount && totalCount > 0 ? 'text-emerald-400' : 'text-white/40'}`}>
          {generatedCount}/{totalCount}
        </span>
      </div>

      {/* 提示文字 */}
      {generatedCount > 0 && (
        <p className="text-xs text-white/40">
          点击图片可单独调整和重新生成
        </p>
      )}

      {/* 预览网格 */}
      <div className={`grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-5`}>
        {previewConfigs.map((config) => (
          <PreviewItem
            key={config.type}
            config={config}
            image={imageMap[config.type]}
            isSelected={selectedType === config.type}
            onClick={() => onSelect(config.type)}
            onPreview={setPreviewUrl}
          />
        ))}
      </div>

      {/* 空状态 */}
      {generatedCount === 0 && (
        <p className="text-xs text-white/30 text-center py-2">
          {totalCount === 0 ? '请先选择至少一种图片类型' : '生成完成后，图片将显示在这里'}
        </p>
      )}

      {/* 图片查看器 */}
      <ImageViewer
        isOpen={!!previewUrl}
        imageUrl={previewUrl || ''}
        onClose={() => setPreviewUrl(null)}
      />
    </div>
  );
}

export default PreviewGallery;
