# 😊 AI 表情包生成器

> [English Documentation](./README.md)


一款 AI 驱动的表情包生成工具，上传图片、描述风格，一键生成专属表情包。

🔗 **在线体验：** [meme-ai-generator.vercel.app](https://meme-ai-generator.vercel.app/)

## ✨ 功能特性

- **AI 生成** - 使用 Gemini 或 OpenAI API 生成定制表情包
- **智能分割** - 自动从生成的图片中提取单个表情
- **手动上传** - 上传已有的表情包图片进行切割提取
- **表情编辑** - 编辑、重新生成或下载单个表情
- **批量下载** - 将所有表情打包为 ZIP 文件，支持标准化尺寸
- **背景移除** - 生成干净的透明背景贴纸
- **双语支持** - 中英文提示词模板

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm（推荐）或 npm
- [Google AI Studio](https://aistudio.google.com/) 或 [OpenAI](https://platform.openai.com/) 的 API 密钥

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/meme-ai-generator.git
cd meme-ai-generator

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 配置

1. 在浏览器中打开应用
2. 点击右上角的设置图标（⚙️）
3. 输入 API 密钥和 Base URL：
   - **Gemini**：Base URL 填写 `https://generativelanguage.googleapis.com/v1beta`
   - **OpenAI**：Base URL 填写 `https://api.openai.com/v1` 或你的自定义端点

## 📖 使用指南

### AI 生成模式

1. **上传图片** - 添加素材图（你的主体）和/或基准图（风格参考）
2. **编写提示词** - 描述你想要的表情包风格（如"Q版萌系，包含各种情绪"）
3. **生成** - 点击"开始生成"，等待 AI 创作
4. **分割** - 使用 AI 智能分割或传统算法提取单个表情
5. **编辑下载** - 微调单个表情或批量下载全部

### 上传切割模式

1. 切换到"上传切割"标签页
2. 上传已有的表情包拼图
3. 点击"开始切割"提取单个表情
4. 按需编辑或下载

## 🛠️ 技术栈

- **框架：** React 19 + TypeScript
- **构建工具：** Vite
- **样式：** Tailwind CSS
- **状态管理：** Zustand
- **AI 集成：** Google Generative AI SDK、OpenAI SDK
- **图像处理：** @imgly/background-removal

## 📁 项目结构

```
src/
├── components/     # React 组件
├── services/       # AI、图像处理、下载服务
├── store/          # Zustand 状态管理
├── types/          # TypeScript 类型定义
└── test/           # 测试文件
```

## 🧪 开发

```bash
# 运行测试
pnpm test

# 监听模式运行测试
pnpm test:watch

# 代码检查
pnpm lint

# 生产构建
pnpm build
```

## 📄 许可证

MIT

