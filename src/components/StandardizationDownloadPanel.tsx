/**
 * 微信表情标准化下载面板组件
 * 
 * 功能：
 * - 单张下载按钮
 * - 批量下载按钮
 * - 显示文件信息（尺寸、大小）
 * 
 * Requirements: 6.3, 6.4
 */

import { useMemo } from 'react';
import type { StandardizationDownloadPanelProps, ProcessedImage } from '../types/wechatStandardization';
import { WECHAT_SPECS } from '../services/wechatConstants';

/**
 * 下载项配置
 */
const DOWNLOAD_CONFIGS = [
  {
    type: 'banner' as const,
    label: 'P1 详情页横幅',
    spec: WECHAT_SPECS.BANNER,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    type: 'cover' as const,
    label: 'P2 表情封面图',
    spec: WECHAT_SPECS.COVER,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: 'icon' as const,
    label: 'P3 聊天页图标',
    spec: WECHAT_SPECS.ICON,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

/**
 * 下载图标 SVG
 */
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

/**
 * ZIP 图标 SVG
 */
const ZipIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
    />
  </svg>
);

/**
 * 单个下载项组件
 */
interface DownloadItemProps {
  type: 'banner' | 'cover' | 'icon';
  label: string;
  spec: typeof WECHAT_SPECS.BANNER | typeof WECHAT_SPECS.COVER | typeof WECHAT_SPECS.ICON;
  icon: React.ReactNode;
  image: ProcessedImage | null;
  onDownload: () => void;
  disabled?: boolean;
}

function DownloadItem({
  label,
  spec,
  icon,
  image,
  onDownload,
  disabled = false,
}: DownloadItemProps) {
  const isAvailable = image !== null;
  const isDisabled = disabled || !isAvailable;

  return (
    <div
      className={`
        flex items-center justify-between p-3 rounded-lg border
        transition-all duration-200
        ${isAvailable
          ? 'border-white/[0.08] bg-[#1a1a1a]/50'
          : 'border-white/[0.04] bg-[#1a1a1a]/30'
        }
      `}
    >
      {/* 左侧：图标和信息 */}
      <div className="flex items-center gap-3">
        <span className={`${isAvailable ? 'text-white/50' : 'text-white/20'}`}>
          {icon}
        </span>
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${isAvailable ? 'text-white/80' : 'text-white/30'}`}>
            {label}
          </span>
          {image ? (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span>{image.width}×{image.height}</span>
              <span>•</span>
              <span>{image.sizeKB.toFixed(1)} KB</span>
              <span>•</span>
              <span className="uppercase">{image.format}</span>
              {image.hasTransparency && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400/70">透明</span>
                </>
              )}
            </div>
          ) : (
            <span className="text-xs text-white/20">
              {spec.width}×{spec.height} • 等待生成
            </span>
          )}
        </div>
      </div>

      {/* 右侧：下载按钮 */}
      <button
        onClick={onDownload}
        disabled={isDisabled}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm
          transition-all duration-200
          ${isDisabled
            ? 'text-white/20 cursor-not-allowed'
            : 'text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer'
          }
        `}
        aria-label={`下载 ${label}`}
      >
        <DownloadIcon />
        <span className="hidden sm:inline">下载</span>
      </button>
    </div>
  );
}

/**
 * 微信表情标准化下载面板组件
 * 
 * @param banner - P1 横幅
 * @param cover - P2 封面
 * @param icon - P3 图标
 * @param onDownloadSingle - 单张下载回调
 * @param onDownloadAll - 批量下载回调
 * @param disabled - 是否禁用
 */
export function StandardizationDownloadPanel({
  banner,
  cover,
  icon,
  onDownloadSingle,
  onDownloadAll,
  disabled = false,
}: StandardizationDownloadPanelProps) {
  // 获取图片的辅助函数
  const getImageByType = (type: 'banner' | 'cover' | 'icon'): ProcessedImage | null => {
    switch (type) {
      case 'banner':
        return banner;
      case 'cover':
        return cover;
      case 'icon':
        return icon;
    }
  };

  // 计算可下载数量
  const availableCount = useMemo(() => {
    let count = 0;
    if (banner) count++;
    if (cover) count++;
    if (icon) count++;
    return count;
  }, [banner, cover, icon]);

  // 计算总文件大小
  const totalSizeKB = useMemo(() => {
    let total = 0;
    if (banner) total += banner.sizeKB;
    if (cover) total += cover.sizeKB;
    if (icon) total += icon.sizeKB;
    return total;
  }, [banner, cover, icon]);

  // 是否可以批量下载
  const canDownloadAll = availableCount > 0 && !disabled;

  // 是否全部完成
  const isAllCompleted = availableCount === 3;

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">下载</h3>
        {availableCount > 0 && (
          <span className={`text-xs ${isAllCompleted ? 'text-emerald-400' : 'text-white/40'}`}>
            {availableCount}/3 可下载
          </span>
        )}
      </div>

      {/* 下载项列表 */}
      <div className="space-y-2">
        {DOWNLOAD_CONFIGS.map((config) => (
          <DownloadItem
            key={config.type}
            type={config.type}
            label={config.label}
            spec={config.spec}
            icon={config.icon}
            image={getImageByType(config.type)}
            onDownload={() => onDownloadSingle(config.type)}
            disabled={disabled}
          />
        ))}
      </div>

      {/* 批量下载区域 */}
      <div className="pt-3 border-t border-white/[0.08]">
        <button
          onClick={onDownloadAll}
          disabled={!canDownloadAll}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
            text-sm font-medium transition-all duration-200
            ${canDownloadAll
              ? 'bg-[#646cff] hover:bg-[#747bff] text-white cursor-pointer'
              : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
            }
          `}
          aria-label="批量���载所有图片"
        >
          <ZipIcon />
          <span>批量下载 ZIP</span>
          {availableCount > 0 && (
            <span className={`text-xs ${canDownloadAll ? 'text-white/70' : 'text-white/20'}`}>
              ({availableCount} 个文件, {totalSizeKB.toFixed(1)} KB)
            </span>
          )}
        </button>

        {/* 提示信息 */}
        {availableCount === 0 && (
          <p className="mt-2 text-xs text-white/30 text-center">
            生成图片后即可下载
          </p>
        )}
        {availableCount > 0 && !isAllCompleted && (
          <p className="mt-2 text-xs text-white/40 text-center">
            部分图片尚未生成，可先下载已完成的图片
          </p>
        )}
        {isAllCompleted && (
          <p className="mt-2 text-xs text-emerald-400/70 text-center">
            所有图片已就绪，点击上方按钮下载 ZIP 包
          </p>
        )}
      </div>

      {/* 文件命名说明 */}
      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
        <p className="text-xs text-white/30 mb-2">文件命名规范：</p>
        <ul className="text-xs text-white/40 space-y-1">
          <li>• P1: banner_750x400.png/jpg</li>
          <li>• P2: cover_240x240.png</li>
          <li>• P3: icon_50x50.png</li>
        </ul>
      </div>
    </div>
  );
}

export default StandardizationDownloadPanel;
