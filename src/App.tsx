import { SettingsDrawer, WorkPanel, EmojiGrid, EmojiEditor, SlideTransition } from './components';
import { WeChatStandardizationResultPanel } from './components/WeChatStandardizationResultPanel';
import { useAppStore } from './store/useAppStore';
import './App.css';

function App() {
  const {
    extractedEmojis,
    selectedEmojiId,
    selectEmoji,
    deleteEmoji,
    workMode,
  } = useAppStore();

  const selectedEmoji = extractedEmojis.find((e) => e.id === selectedEmojiId);

  return (
    <div className="app-container">
      {/* 设置抽屉 */}
      <SettingsDrawer />

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

      {/* 主内容区域 - 两栏布局 */}
      <main className="app-main">
        <div className="two-column-grid">
          {/* 左侧：工作面板 */}
          <section className="work-column">
            <WorkPanel />
          </section>

          {/* 右侧：结果预览 + 编辑器 */}
          <aside className="result-column">
            {/* 微信标准化结果面板 */}
            <div style={{ display: workMode === 'standardize' ? 'block' : 'none' }}>
              <WeChatStandardizationResultPanel />
            </div>

            {/* 表情提取和编辑面板 */}
            <div style={{ display: workMode !== 'standardize' ? 'block' : 'none' }}>
              <div className="panel-section card">
                <EmojiGrid
                  emojis={extractedEmojis}
                  selectedId={selectedEmojiId}
                  onSelect={selectEmoji}
                  onDelete={deleteEmoji}
                  isLoading={false}
                  error={null}
                  onRetry={() => {}}
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
            </div>
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
