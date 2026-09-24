# dsh-skills-manager

[English](README.md) | 简体中文

`dsh-skills-manager` 是 **DSH Native Skills 的可视化管理插件**。它沿用 DSH 原生 Skill Registry、Loader、Runtime、发现、渐进加载与上下文注入机制，作为管理层增加 Settings 页面和手动 External Skills 去重导入流程，不实现第二套 Skills Runtime。

## 功能

- Settings → 技能：搜索、查看、新建、编辑和删除 DSH Native Skills。
- 支持 Claude Code、OpenAI Codex、Cursor 和 Gemini CLI 的外部技能导入。
- 使用规范化路径、内容指纹和名称冲突三层去重规则。
- 不覆盖 DSH 已有技能，不修改外部源文件。
- 接入 DSH 原生 Locale Runtime，中文/英文无需刷新页面即可切换。
- 响应式表格：描述默认按视觉行数截断为两行，逐行展开；路径提供 tooltip；Actions 使用紧凑菜单。

## 截图

主界面位于 DSH Settings → 技能。页面包含稳定的标题行、可换行的搜索/导入工具栏、自适应导入统计以及适合窄 Settings 面板的 fixed-layout 技能表格。

## 环境要求

- 当前 DSH Web 客户端，以及 Locale、Settings Slots、UI Primitives 和 Client Modules。
- Node.js 20 或更高版本。
- 已启用原生 Skills 服务的 DSH Web profile。

## 安装

把正式 Bundle 安装到 profile：

```bash
dsh plugin add dsh-skills-manager
```

使用单独的验证 profile：

```bash
dsh plugin --profile skills-test add dsh-skills-manager
dsh --profile skills-test --dump-config
```

包内声明了 `dsh.bundle`，并携带 `cordis.patch.yml`。DSH 会自动加入 Bundle layer 并激活 Host 插件和浏览器 Client entry，不需要手动编辑 `~/.dsh/cordis.patch.yml`。

## 使用

启动 DSH Web，进入 Settings → 技能。导航标签跟随 DSH 当前语言：中文显示 `技能`，英文显示 `Skills`。在 Settings → 语言中切换后，插件文案会实时更新。

描述默认限制为两行视觉文本。只有实际渲染内容溢出时才显示“展开/More”按钮；每一行独立维护展开状态。长路径保持省略显示，并可通过悬停或键盘焦点查看完整路径。

## 外部技能导入

外部技能导入只由用户手动触发。在 Settings 页面点击“扫描外部技能”即可扫描支持的外部技能目录，需要时再进入冲突处理页面。插件加载时 Host 不会扫描或导入这些目录。导入过程会明确展示冲突，不会静默覆盖 DSH 管理的技能，只写入 DSH 管理的技能目录。

## 去重规则

导入分类使用三层规则：

1. 规范化真实路径，避免同一个源被扫描多次。
2. 确定性内容指纹，识别不同目录中的相同技能。
3. 名称冲突进入处理页面，不静默覆盖 DSH 已有技能。

## 安全策略

插件把运行时行为全部交给 DSH Native Skills，不替换 Registry、Loader、Runtime、Discovery、渐进加载或 Context Injection。删除和导入操作限制在 DSH 管理目录内，绝不删除或覆盖外部源文件。npm 包没有 `postinstall` 扫描行为。

## 开发

Host 入口是 `src/index.ts`，DSH ModuleLoader Client 入口是 `src/client/index.ts`。可以用 `DSH_CHECKOUT` 指定本地 DSH checkout：

```bash
DSH_CHECKOUT=/path/to/deepseek-harness bash scripts/build.sh
```

## 构建

```bash
pnpm run typecheck
pnpm run typecheck:client
pnpm run test
pnpm run build
pnpm pack
```

`prepack` 会构建 Host 和 Client 产物并检查 Bundle metadata。发布 tarball 包含预构建的 `lib/index.js`、`lib/client.js`、声明文件、`cordis.patch.yml`、中英文 README 和 `LICENSE`。

## 发布

更新版本并验证 tarball 后：

```bash
npm pack
npm publish
```

Client 构建仍是调用 `window.__ModuleLoader__.load({ id: 'dsh-skills-manager', factory })` 的 CJS closure factory，不会退回普通浏览器 ESM bundle。

## 兼容性

包面向 DSH `0.1.0-rc` 及后续声明范围，以及 React 18。实现使用当前 DSH Locale Runtime（`ctx.locale.register`、`ctx.locale.bind` 和 locale-aware Settings section slot）、当前 UI Primitives（`Button`、`Input`、`Menu`、`Tooltip`）和当前 Bundle patch 合约。

这些接口在版本之间发生过迁移，插件因此探测运行中的 Host 实际提供了哪一代，而不是绑定单一版本：

- **预设技能作用域。** `agentPresets.standingKeyFor()`（≤0.1.6）或 `agentPresets.acquireScope()`（≥0.1.7，返回引用租约，插件在每次读取后释放）。两者都不可用或预设不可用时，管理器列出全局层并在诊断中说明。
- **导入元数据。** 该版本仍提供 `ctx.settings.register()` 时使用它；否则插件写入自己的 `$DSH_HOME/skills-manager/metadata.json`。DSH 0.1.7 用 profile patch 表单投影取代了 settings 命名空间 seam，后者面向组合条目而非插件私有数据。
- **打开技能目录。** 挂载了 session Remote（`canOpenWorkspacePath` / `openWorkspacePath`）的版本走 Remote；仍发布 `connection.api.host.openPath()` 旧门面的版本走旧门面；两者皆无时不显示该控件。
- **下拉箭头图标。** `IconChevronDownOutlineMedium`/`Regular`（≥0.1.7）或 `IconChevronDownOutline14`（≤0.1.6），运行时解析；都不提供时不渲染图标。

插件的 devDependencies 跟随其所针对的 DSH 版本（当前为 0.1.7-rc.1），使类型检查看到与 Host 相同的契约。

## 许可证

BSD-3-Clause，详见 [LICENSE](LICENSE)。
