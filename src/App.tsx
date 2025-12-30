import { ConfigPanel, ImageUploader, PromptPanel, GeneratePanel, EmojiGrid, EmojiEditor, SlideTransition } from './components';
import { useAppStore } from './store/useAppStore';
import { MATERIAL_IMAGE_LIMIT, REFERENCE_IMAGE_LIMIT } from './services/imageValidation';
import { extractAllEmojis } from './services/imageSplitter';
import { useState, useCallback } from 'react';
import './App.css';

function App() {
  const {
    materialImages,
    referenceImages,
    addMaterialImage,
    addReferenceImage,
    removeImage,
    generatedImage,
    extractedEmojis,
    setExtractedEmojis,
    selectedEmojiId,
    selectEmoji,
  } = useAppStore();

  const [isSplitting, setIsSplitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  const handleMaterialUpload = (files: File[]) => {
    files.forEach((file) => addMaterialImage(file));
  };

  const handleReferenceUpload = (files: File[]) => {
    files.forEach((file) => addReferenceImage(file));
  };

  // 分割表情
  const handleSplitEmojis = useCallback(async () => {
    if (!generatedImage) return;

    setIsSplitting(true);
    setSplitError(null);

    try {
      const emojis = await extractAllEmojis(generatedImage, {
        useAdvancedRemoval: true,
        tolerance: 30,
        minArea: 100,
        minSize: 10,
      });

      if (emojis.length === 0) {
        setSplitError('未能检测到表情包，请确保图片背景为纯色');
      } else {
        setExtractedEmojis(emojis);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分割失败';
      setSplitError(errorMessage);
    } finally {
      setIsSplitting(false);
    }
  }, [generatedImage, setExtractedEmojis]);

  // 获取选中的表情
  const selectedEmoji = extractedEmojis.find((e) => e.id === selectedEmojiId);

  return (
    <div className="app-container">
      {/* 顶部导航栏 */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-logo">
            <span className="logo-icon">😊</span>
            <h1 className="logo-text">AI 表情包生成器</h1>
          </div>
          <p className="header-subtitle">上传图片，输入描述，一键生成专属表情包</p>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="app-main">
        <div className="main-grid">
          {/* 左侧面板：配置 + 上传 */}
          <aside className="panel-left">
            <div className="panel-section">
              <ConfigPanel />
            </div>
            
            <div className="panel-section card">
              <h2 className="section-title">
                <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                图片上传
              </h2>
              
              <div className="upload-sections">
                <ImageUploader
                  type="material"
                  maxCount={MATERIAL_IMAGE_LIMIT}
                  images={materialImages}
                  onUpload={handleMaterialUpload}
                  onRemove={(id) => removeImage(id, 'material')}
                  title={`素材图（最多 ${MATERIAL_IMAGE_LIMIT} 张）`}
                />
                
                <div className="upload-divider" />
                
                <ImageUploader
                  type="reference"
                  maxCount={REFERENCE_IMAGE_LIMIT}
                  images={referenceImages}
                  onUpload={handleReferenceUpload}
                  onRemove={(id) => removeImage(id, 'reference')}
                  title={`基准图（最多 ${REFERENCE_IMAGE_LIMIT} 张）`}
                />
              </div>
            </div>
          </aside>

          {/* 中间面板：提示词 + 生成 */}
          <section className="panel-center">
            <div className="panel-section">
              <PromptPanel />
            </div>
            
            <div className="panel-section">
              <GeneratePanel />
            </div>
            
            {/* 分割按钮 */}
            {generatedImage && extractedEmojis.length === 0 && (
              <div className="panel-section card split-panel">
                <button
                  onClick={handleSplitEmojis}
                  disabled={isSplitting}
                  className={`split-button ${isSplitting ? 'loading' : ''}`}
                >
                  {isSplitting ? (
                    <>
                      <span className="spinner" />
                      正在分割...
                    </>
                  ) : (
                    <>
                      <svg className="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      分割提取表情
                    </>
                  )}
                </button>
                <p className="split-hint">点击按钮自动检测并分割表情包</p>
              </div>
            )}
          </section>

          {/* 右侧面板：结果预览 + 编辑器 */}
          <aside className="panel-right">
            <div className="panel-section card">
              <EmojiGrid
                emojis={extractedEmojis}
                selectedId={selectedEmojiId}
                onSelect={selectEmoji}
                isLoading={isSplitting}
                error={splitError}
                onRetry={handleSplitEmojis}
              />
            </div>

            {/* 表情编辑器 */}
            <SlideTransition show={!!selectedEmoji} direction="right" duration={250}>
              {selectedEmoji && (
                <div className="panel-section editor-panel">
                  <EmojiEditor
                    emoji={selectedEmoji}
                    emojiIndex={extractedEmojis.findIndex((e) => e.id === selectedEmojiId) + 1}
                    onClose={() => selectEmoji(null)}
                  />
                </div>
              )}
            </SlideTransition>
          </aside>
        </div>
      </main>

      {/* 底部信息 */}
      <footer className="app-footer">
        <p>使用 AI 技术生成表情包 · 支持 Gemini 和 OpenAI API</p>
      </footer>
    </div>
  );
}

export default App;
