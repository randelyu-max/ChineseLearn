# HanziQuest（汉字探险）设计与 Codex 实施包

本目录是一套可直接复制到代码仓库、交给 Codex 分阶段实现的产品与技术基线。

## 1. 默认产品范围

在未另行指定业务限制的情况下，本设计采用以下范围：

- 核心儿童：6–10 岁，在海外长大，能听说普通话但识字和阅读能力较弱。
- 账号主体：家长或法定监护人；儿童只有档案，不创建邮箱、手机号或社交账号。
- 首发平台：iOS、Android；另有 Web 内容管理后台。
- 首发课程：普通话、简体中文；底层模型支持繁体映射和后续课程轨道。
- MVP 内容：120 个核心汉字、约 250 个词、80 个句子、20 个短故事、4 个主题世界。
- 单次学习：默认 8 分钟，以短关卡、复习、新字、迁移阅读和奖励组成。
- AI 边界：自适应学习引擎决定学习顺序和难度；生成式 AI 只生成受约束的故事、提示和家长报告文案。
- 儿童安全：无开放聊天、无广告、无公开排行榜、无陌生人互动、无无限奖励循环。

## 2. 文件说明

| 文件                               | 用途                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `HanziQuest_完整产品技术设计.md`   | PRD + 技术设计主文档，包含产品、课程、自适应算法、AI、架构、数据库、API、离线、合规、测试、上线和验收 |
| `HanziQuest_完整产品技术设计.docx` | 适合阅读、评审和打印的 Word 版本                                                                      |
| `AGENTS.md`                        | 放在仓库根目录，作为 Codex 的长期工程、安全和学习规则                                                 |
| `CODEX_IMPLEMENTATION_PLAN.md`     | 将项目拆成可审查、可测试、可回滚的小任务，并提供任务提示和验收条件                                    |
| `supabase_schema.sql`              | Supabase/PostgreSQL 起始 Schema；应由 Codex 审查后拆成正式迁移和 RLS 测试                             |
| `AI_CONTENT_CONTRACTS.ts`          | AI 故事、周报和语音评估的 Zod 合同起点；强调去标识化和严格验证                                        |
| `VALIDATION_REPORT.md`             | 本次交付已完成的文档、TypeScript 和 SQL 检查，以及仍需在真实仓库执行的验证                            |
| `PACKAGE_MANIFEST.sha256`          | 包内文件的 SHA-256 校验清单（不包含清单自身）                                                         |
| `assets/`                          | 系统架构、学习循环和 AI 内容安全管线图                                                                |

## 3. 建议的仓库放置方式

```text
hanziquest/
├── AGENTS.md
├── README.md
├── docs/
│   ├── PRODUCT_TECH_DESIGN.md
│   └── CODEX_IMPLEMENTATION_PLAN.md
├── packages/
│   └── contracts/
│       └── src/
│           └── ai-content.ts
├── supabase/
│   └── migrations/
│       └── 00000000000000_initial_schema.sql
└── ...
```

对应复制关系：

```text
HanziQuest_完整产品技术设计.md  → docs/PRODUCT_TECH_DESIGN.md
CODEX_IMPLEMENTATION_PLAN.md    → docs/CODEX_IMPLEMENTATION_PLAN.md
AI_CONTENT_CONTRACTS.ts         → packages/contracts/src/ai-content.ts
supabase_schema.sql             → supabase/migrations/<timestamp>_initial_schema.sql
AGENTS.md                       → AGENTS.md
```

不要把 SQL 和 TypeScript 起始文件未经审查地直接用于生产。Codex 应先核对当前依赖、Supabase/PostgreSQL 版本、目标国家、商店政策和实际数据流，再拆分、测试和提交。

## 4. 用 Codex 开始开发

### 第一步：建立空仓库和初始检查点

```bash
mkdir hanziquest
cd hanziquest
git init
# 将本包文件复制到上面的建议位置
git add .
git commit -m "docs: add HanziQuest implementation baseline"
```

### 第二步：向 Codex 提交第一个任务

```text
请先读取根目录 AGENTS.md、docs/PRODUCT_TECH_DESIGN.md 和
CODEX_IMPLEMENTATION_PLAN.md。

进入 Plan mode。当前只执行 Task 0.1：初始化 Monorepo。
不要实现业务页面、数据库业务逻辑或调用在线 AI 服务。

请先检查本机 Node、包管理器、Expo、Supabase CLI 和 Git 环境，然后：
1. 给出文件级实施计划和版本选择理由；
2. 建立 Expo + React Native 移动端、Next.js 管理后台、共享包和 Supabase 目录；
3. 配置 pnpm workspace、lint、format、typecheck、test、build 和基础 CI；
4. 创建无秘密的 .env.example；
5. 运行全部相关验证；
6. 自审 diff，并报告实际运行结果、风险和回滚方式。

不要跳到 Task 0.2。不要声称未运行的测试已经通过。
```

### 第三步：严格按任务推进

一次只交给 Codex 一个实施计划中的任务。每个任务都应：

1. 先阅读相关设计章节和当前代码。
2. 在 Plan mode 中明确范围、非目标、测试和回滚。
3. 建立 Git 检查点。
4. 用最小 diff 实现。
5. 运行真实验证，不以静态推测代替。
6. 自审安全、隐私、学习规则和离线幂等性。
7. 人工审查后再进入下一任务。

## 5. 建议的首批开发顺序

1. Task 0.1：Monorepo 与工程基线。
2. Task 0.2：共享 Zod 合同和错误模型。
3. Task 1.1–1.3：课程领域模型、内容验证器、关卡状态机。
4. Task 1.4–1.5：四种核心题型与 20 字静态演示课程。
5. Task 2.1–2.5：Supabase、RLS、家长账号、儿童档案和家长门。
6. Task 3.1 起：学习状态、自适应算法、诊断和每日计划。

在静态关卡和确定性学习引擎稳定前，不建议先开发 AI 故事或语音功能。

## 6. 必须保留的工程边界

- 学习引擎必须是可测试的纯函数模块，不访问网络、不调用 AI、不直接读数据库。
- 服务器重新判断答案，客户端的 `isCorrect` 不能作为可信事实。
- 作答事件、会话完成和奖励发放必须幂等。
- 奖励余额、库存、掌握度和课程发布状态由服务端维护。
- 每个家庭私有表默认拒绝并启用 RLS；需要跨家庭拒绝测试。
- AI 密钥、Supabase secret/service-role key 和管理密钥永不进入客户端。
- 儿童可见 AI 内容必须经过结构化解析、确定性课程校验、安全审核和静态回退。
- 不向 AI 提供商发送儿童姓名、昵称、家庭、学校、位置或不必要的自由文本。
- 云端处理儿童语音默认关闭，只有在完成独立同意、保留配置和法律评估后才启用。

## 7. 需要尽早由业务确认的事项

主设计文档第 29 章列出了完整清单。最先需要决定的是：

- 首发国家与法律/商店审核范围。
- 简体优先是否符合目标家庭；是否需要同步推出繁体。
- 主要口语轨道是否只支持普通话。
- 年龄是否保持 6–10 岁。
- 免费层、订阅层和家庭儿童数量。
- 是否需要教师/机构版。
- 云端语音是否进入首发范围。

这些问题不妨碍先完成 M0–M1 的工程和静态课程原型，但会影响后续同意、内容和发布设计。

## 8. 文档维护

发生以下变化时，应同步更新主设计、ADR、合同、测试和 `AGENTS.md`：

- 产品范围或目标年龄改变。
- 自适应算法、稳定掌握标准或奖励经济改变。
- 新增儿童数据、语音、AI 提供商或第三方 SDK。
- 数据库权限、RLS 或数据保留策略改变。
- API Schema、离线事件或内容版本协议改变。
- 目标国家、商店分类或法律依据改变。

本包是实施基线，不是最终法律意见，也不替代真实儿童用户研究、课程专家评审、安全测试和商店发布审查。

## 9. Task 0.1 工程基线

仓库现已按 pnpm workspace 初始化：

```text
apps/mobile                 Expo + React Native + Expo Router
apps/admin                  Next.js App Router
packages/contracts          共享合同边界（Task 0.2 再实现合同）
packages/learning-engine    确定性学习引擎边界
packages/content-validator  内容验证边界
packages/curriculum         课程模型边界
packages/design-tokens      设计令牌边界
supabase/                   本地 Supabase 配置与空迁移/函数/测试目录
```

### 环境要求

- Node.js 24.18.0（支持范围：`>=22.13.0 <25`）
- pnpm 11.15.1（由根 `packageManager` 固定）
- 本地 Supabase 运行还需要 Docker Desktop；Task 0.1 不启动数据库容器

### 安装与启动

```bash
corepack enable
corepack install --global pnpm@11.15.1
pnpm install --frozen-lockfile

pnpm dev:mobile
pnpm dev:admin
```

移动端默认使用 Expo 开发服务器；管理后台默认位于 `http://localhost:3000`。
当前 Next.js 开发与构建脚本显式使用 Webpack，因为 Turbopack 16.2.11 在包含中文的长
Windows 路径中存在 UTF-8 路径 panic。升级 Next.js 后可先在本分支验证再恢复默认构建器。

如果 Windows 因 Node.js 安装在 `Program Files` 而拒绝 `corepack enable`，可在管理员终端
运行该命令，或用 `corepack enable --install-directory <可写且已加入 PATH 的目录> pnpm`
创建用户级 shim。CI 使用 `pnpm/action-setup`，不依赖系统级 shim。

### 工程验证

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# 或一次运行全部检查
pnpm run validate
```

`.env.example` 仅列出允许暴露给客户端的 Supabase public/publishable 配置。不要把
service-role、secret、签名、支付或 AI 服务密钥写入客户端环境变量或提交到 Git。
