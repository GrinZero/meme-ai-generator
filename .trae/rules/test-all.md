---
alwaysApply: false
description: 编写完成后的闭环测试
---
## Desc

- 当开发完成后，必须执行 `pnpm tsc -b` 来检查类型错误
- 当开发完成后，必须执行 `pnpm lint` 来检查代码规范
- 通过 chrome-devtools-mcp 来验证功能（pnpm dev 后，访问 localhost:5173）是否符合预期并且无报错