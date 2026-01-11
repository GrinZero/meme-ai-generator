import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useWeChatStandardizationStore } from '../store/useWeChatStandardizationStore';
import { PreviewGallery } from './PreviewGallery';
import { ReprocessPanel } from './ReprocessPanel';
import { StandardizationDownloadPanel } from './StandardizationDownloadPanel';
import {
  generateBanner,
  generateCover,
  generateIcon,
  generateAppreciationGuide,
  generateAppreciationThanks,
  // WeChatStandardizationService,
} from '../services/wechatStandardizationService';
import {
  downloadProcessedImage,
  downloadStandardizationZip,
} from '../services/wechatFileService';
import type { ProcessedImage, ProcessingStatus, WImageType } from '../types/wechatStandardization';

export function WeChatStandardizationResultPanel() {
  const { apiConfig } = useAppStore();
  
  const {
    sourceImages,
    result,
    status,
    enabledTypes,
    selectedImageType,
    reprocessPrompt,
    reprocessParams,
    reprocessResult,
    setSelectedImageType,
    setReprocessPrompt,
    setReprocessParams,
    replaceWithReprocessed,
    cancelReprocess,
  } = useWeChatStandardizationStore();

  // 内部状态更新方法
  const setStatus = useCallback((newStatus: ProcessingStatus) => {
    useWeChatStandardizationStore.setState({ status: newStatus });
  }, []);

  const setReprocessResult = useCallback((newResult: ProcessedImage | null) => {
    useWeChatStandardizationStore.setState({ reprocessResult: newResult });
  }, []);

  const isProcessing = useMemo(() => {
    return status.stage === 'generating' || status.stage === 'processing';
  }, [status.stage]);

  // 进度回调
  const handleProgress = useCallback((
    type: 'p1' | 'p2' | 'p3' | 'appreciationGuide' | 'appreciationThanks',
    stage: 'generating' | 'processing' | 'completed' | 'error',
    progress?: number,
    error?: string
  ) => {
    if (stage === 'error' && error) {
      setStatus({ stage: 'error', message: error });
    } else if (stage === 'generating') {
      setStatus({ stage: 'generating', type, progress: progress || 0 });
    } else if (stage === 'processing') {
      setStatus({ stage: 'processing', type });
    }
  }, [setStatus]);

  // 下载单个图片
  const handleDownloadSingle = useCallback((type: 'banner' | 'cover' | 'icon' | 'appreciationGuide' | 'appreciationThanks') => {
    if (!result) return;

    const image = result[type];
    if (image) {
      downloadProcessedImage(image);
    }
  }, [result]);

  // 批量下载
  const handleDownloadAll = useCallback(async () => {
    if (!result) return;

    try {
      await downloadStandardizationZip({
        banner: result.banner,
        cover: result.cover,
        icon: result.icon,
        appreciationGuide: result.appreciationGuide,
        appreciationThanks: result.appreciationThanks,
      });
    } catch (error) {
      console.error('下载失败:', error);
    }
  }, [result]);

  // 处理图片选择
  const handleImageSelect = useCallback((type: WImageType) => {
    if (selectedImageType === type) {
      setSelectedImageType(null);
    } else {
      setSelectedImageType(type);
    }
  }, [selectedImageType, setSelectedImageType]);

  // 获取选中图片的原始图片
  const getSelectedOriginalImage = useCallback((): ProcessedImage | null => {
    if (!result || !selectedImageType) return null;
    return result[selectedImageType] || null;
  }, [result, selectedImageType]);

  // 重新生成选中的图片
  const handleRegenerate = useCallback(async () => {
    if (!selectedImageType || sourceImages.length === 0 || isProcessing) return;

    setStatus({ stage: 'generating', type: selectedImageType === 'banner' ? 'p1' : selectedImageType === 'cover' ? 'p2' : selectedImageType === 'icon' ? 'p3' : selectedImageType, progress: 0 });

    try {
      let newImage: ProcessedImage;

      switch (selectedImageType) {
        case 'banner':
          newImage = await generateBanner(sourceImages, reprocessPrompt, apiConfig, handleProgress, reprocessParams);
          break;
        case 'cover':
          newImage = await generateCover(sourceImages, reprocessPrompt, apiConfig, handleProgress, reprocessParams);
          break;
        case 'icon':
          newImage = await generateIcon(sourceImages, reprocessPrompt, apiConfig, handleProgress, reprocessParams);
          break;
        case 'appreciationGuide':
          newImage = await generateAppreciationGuide(sourceImages, reprocessPrompt, apiConfig, handleProgress, reprocessParams);
          break;
        case 'appreciationThanks':
          newImage = await generateAppreciationThanks(sourceImages, reprocessPrompt, apiConfig, handleProgress, reprocessParams);
          break;
        default:
          throw new Error('未知的图片类型');
      }

      setReprocessResult(newImage);
      setStatus({ stage: 'completed' });
    } catch (error) {
      setStatus({
        stage: 'error',
        message: error instanceof Error ? error.message : `重新生成失败`,
      });
    }
  }, [selectedImageType, sourceImages, reprocessPrompt, apiConfig, isProcessing, handleProgress, setStatus, setReprocessResult, reprocessParams]);

  // 仅处理图片（不重新生成 AI 图片）
  const handleProcessImage = useCallback(async () => {
    const originalImage = getSelectedOriginalImage();
    if (!selectedImageType || !originalImage || !originalImage.originalBlob || isProcessing) return;

    setStatus({ stage: 'processing', type: selectedImageType === 'banner' ? 'p1' : selectedImageType === 'cover' ? 'p2' : selectedImageType === 'icon' ? 'p3' : selectedImageType });

    try {
      // let newImage: ProcessedImage;
      
      switch (selectedImageType) {
        case 'banner':
           // Banner 不需要额外处理，直接复用 AI 生成的结果，只进行尺寸调整
           // 但我们需要调用 wechatStandardizationService 中的逻辑
           // 由于 service 还没更新，这里暂时通过 generateBanner 传入特殊参数来实现（但这需要改造 service）
           // 或者，我们直接在这里使用 wechatImageProcessor 的逻辑？不推荐，应该封装在 service 中
           
           // 正确做法：更新 service，添加 reprocessXxx 方法
           // 但现在只能在下一步做。
           // 为了让代码编译通过，我先注释掉具体的调用，等 service 更新后再放开
           // 或者使用 any 绕过类型检查（不推荐）
           
           // 既然我可以在同一个 turn 中修改 service，那我应该先去修改 service
           // 但我刚刚已经在 ReprocessPanel 中添加了按钮，现在需要在这里实现逻辑
           
           // 让我们先抛出一个错误，提示需要更新 service
           // 或者，我可以先修改 service，然后再回来修改这里
           // 但工具调用是顺序的。
           
           // 我会先修改 service，然后再回来修改这里。
           // 但现在我已经处于修改这个文件的过程中。
           
           // 方案：
           // 1. 先把这个函数留空或者抛错
           // 2. 修改 service 添加 reprocessXxx
           // 3. 再回来完善这个函数
           
           // 但为了不破坏编译，我先用 generateBanner 占位（虽然它会重新生成 AI）
           // 不，这不符合需求。
           
           // 我决定先注释掉具体实现，等下个 tool call 修改 service 后再补上。
           throw new Error('Service method not implemented yet');
           
        case 'cover':
           throw new Error('Service method not implemented yet');
        case 'icon':
           throw new Error('Service method not implemented yet');
        case 'appreciationGuide':
           throw new Error('Service method not implemented yet');
        case 'appreciationThanks':
           throw new Error('Service method not implemented yet');
        default:
           throw new Error('未知的图片类型');
      }

      // setReprocessResult(newImage);
      // setStatus({ stage: 'completed' });
    } catch (error) {
      setStatus({
        stage: 'error',
        message: error instanceof Error ? error.message : `图片处理失败`,
      });
    }
  }, [selectedImageType, getSelectedOriginalImage, isProcessing, setStatus, setReprocessResult, reprocessParams]);

  // 处理替换操作
  const handleReplace = useCallback(() => {
    replaceWithReprocessed();
  }, [replaceWithReprocessed]);

  // 处理取消操作
  const handleCancelReprocess = useCallback(() => {
    cancelReprocess();
  }, [cancelReprocess]);

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* 预览图库 */}
      <div className="bg-[#242424]/80 backdrop-blur-md rounded-xl border border-white/[0.08] p-4">
        <PreviewGallery
          banner={result?.banner || null}
          cover={result?.cover || null}
          icon={result?.icon || null}
          appreciationGuide={result?.appreciationGuide || null}
          appreciationThanks={result?.appreciationThanks || null}
          selectedType={selectedImageType}
          onSelect={handleImageSelect}
          enabledTypes={enabledTypes}
        />
      </div>

      {/* 单独处理面板或下载面板 */}
      <div className="bg-[#242424]/80 backdrop-blur-md rounded-xl border border-white/[0.08] p-4 flex-1">
        {selectedImageType && getSelectedOriginalImage() ? (
          <ReprocessPanel
            selectedType={selectedImageType}
            originalImage={getSelectedOriginalImage()!}
            newImage={reprocessResult}
            prompt={reprocessPrompt}
            onPromptChange={setReprocessPrompt}
            processingParams={reprocessParams}
            onParamsChange={setReprocessParams}
            onRegenerate={handleRegenerate}
            onProcessImage={handleProcessImage}
            onReplace={handleReplace}
            onCancel={handleCancelReprocess}
            isProcessing={isProcessing}
          />
        ) : (
          <StandardizationDownloadPanel
            banner={result?.banner || null}
            cover={result?.cover || null}
            icon={result?.icon || null}
            appreciationGuide={result?.appreciationGuide || null}
            appreciationThanks={result?.appreciationThanks || null}
            onDownloadSingle={handleDownloadSingle}
            onDownloadAll={handleDownloadAll}
          />
        )}
      </div>
    </div>
  );
}
