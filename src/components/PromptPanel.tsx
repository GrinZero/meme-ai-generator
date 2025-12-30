/**
 * PromptPanel - 提示词构建组件
 * 
 * 功能：
 * - 用户提示词输入区域
 * - 示例提示词展示
 * - 字符计数显示
 * 
 * Requirements: 4.1, 4.4
 */

import { useAppStore } from '../store/useAppStore';

// 示例提示词列表
const EXAMPLE_PROMPTS = [
  '这是我的小猫咪美长起司小猫咪，我希望表情包是 Q 版萌系的风格',
  '请生成一组可爱的表情包，包含开心、难过、生气、惊讶等情绪',
  '帮我生成一组搞笑的表情包，带有夸张的表情和动作',
  '生成一组适合日常聊天使用的表情包，风格要简洁可爱',
];

// 最大字符数限制
const MAX_PROMPT_LENGTH = 1000;

export function PromptPanel() {
  const { userPrompt, setUserPrompt } = useAppStore();

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_PROMPT_LENGTH) {
      setUserPrompt(value);
    }
  };

  const handleExampleClick = (example: string) => {
    setUserPrompt(example);
  };

  const characterCount = userPrompt.length;
  const isNearLimit = characterCount > MAX_PROMPT_LENGTH * 0.8;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        提示词
      </h2>

      {/* 用户提示词输入区域 */}
      <div className="mb-4">
        <label
          htmlFor="user-prompt"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          自定义提示词
        </label>
        <textarea
          id="user-prompt"
          value={userPrompt}
          onChange={handlePromptChange}
          placeholder="描述你想要的表情包风格、内容、情绪等..."
          className="w-full h-24 sm:h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     placeholder-gray-400 dark:placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     resize-none text-sm sm:text-base"
          aria-describedby="prompt-char-count"
        />
        
        {/* 字符计数显示 */}
        <div
          id="prompt-char-count"
          className={`text-sm mt-1 text-right ${
            isNearLimit
              ? 'text-orange-500 dark:text-orange-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {characterCount} / {MAX_PROMPT_LENGTH}
        </div>
      </div>

      {/* 示例提示词展示 */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          示例提示词
        </h3>
        <div className="space-y-2">
          {EXAMPLE_PROMPTS.map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400
                         bg-gray-50 dark:bg-gray-700/50 rounded-md
                         hover:bg-gray-100 dark:hover:bg-gray-700
                         transition-colors duration-150
                         border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
