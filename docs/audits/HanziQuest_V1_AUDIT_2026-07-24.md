# HanziQuest V1 全量代码、文档与产品审计报告

**审计日期：** 2026-07-24
**审计快照：** `HanziQuest-Audit-20260724-083312.zip`
**快照分支：** `codex/task-8-2a-review-center`
**快照 HEAD：** `70f1f53af318e9a0b2713c8f3f52bc039cbb935a`
**仓库规模：** 346 个文件，其中约 240 个 TypeScript/TSX 文件、78 个测试文件。

---

## 1. 审计范围与限制

本次完成了以下工作：

1. 对整个快照做文件、路由、依赖、领域词、隐私边界和发布声明索引。
2. 深读全部活动中的产品/技术主文档、实施计划、ADR、发布清单、隐私与商店资料。
3. 深读移动端全部正式路由及主要学习、拼音、离线、书写、签名、认证和 Profile 功能。
4. 深读 API 全部路由和关键服务，包括 `session-plan`、`attempts-batch`、`review-center`、Profile 和签名汇总。
5. 深读共享合同、课程 Schema、内容验证器、学习引擎关键算法和 PostgreSQL 迁移。
6. 对文档声明和实际运行时代码进行逐项对照。

限制：

- 上传包没有 `.git` 目录和 `node_modules`，当前审计环境也不能从外网安装依赖，因此本次**没有独立重跑** pnpm、Expo、PostgreSQL 或浏览器测试。
- 本报告中关于“396 项测试通过”等信息，只代表 `V1_RELEASE_CHECKLIST.md` 中的 Codex 报告，不代表我在当前容器中独立复现。
- 快照中的 8.2A 文件已经写入工作树，文档也标记为 complete；但用户当时说 Codex 仍在执行 8.2A，因此最终应以 Codex 停止后的真实完成报告和最终 diff 为准。

---

# 2. 总体结论

## 当前产品等级

当前仓库不是一个可以直接公开提交 App Store / Google Play 的完整 V1，更准确的定位是：

> **工程基础较扎实的 Closed Alpha / 功能原型。**

底层工程中有很多值得保留的高质量设计：

- 单用户账户模型清晰；
- Better Auth + 服务端 API + PostgreSQL 强制 RLS；
- 版本化 Zod 合同；
- 学习算法保持纯函数和可测试；
- Attempts 不可变、幂等和离线 Outbox 基础；
- 原始书写轨迹 local-first；
- 第一版没有生成式 AI 运行时；
- 8.2A 的认证和只读边界总体正确。

但是，当前最大的缺口并不是单纯“复习页面还没做”，而是：

> **服务器生成的学习计划、移动端实际可完成的关卡、拼音作答、掌握度更新、复习计划和离线同步还没有形成一条真正贯通的生产学习链路。**

因此，**不建议 8.2A 完成后直接按原计划做一个只展示列表的 8.2B，然后宣布 V1 可发布。**

---

# 3. 实际功能状态矩阵

| 功能                                     | 实际状态                  | 审计判断                                                 |
| ---------------------------------------- | ------------------------- | -------------------------------------------------------- |
| 注册、登录、退出、密码恢复、Session 恢复 | 已实现                    | 可保留，需补账号删除和离线退出边界                       |
| 单人 Profile                             | 已实现                    | 可保留                                                   |
| 首次设置                                 | 已实现                    | 语言选择与实际本地化不一致                               |
| 学习首页                                 | 只跳到固定 demo           | **不是正式学习首页**                                     |
| 汉字关卡                                 | 4 种题型本地 demo         | 有组件和模型，但未接正式 session-plan                    |
| 拼音                                     | 6 种本地演示题型          | 无服务端作答、掌握度和复习闭环                           |
| 自适应学习引擎                           | 算法已实现                | 尚未被正式移动端学习流程完整消费                         |
| 多维诊断                                 | learning-engine 中已实现  | 没有 onboarding UI、结果持久化或起点应用                 |
| Session Plan API                         | 已实现第一版              | 返回候选描述，不返回可直接渲染的不可变题目快照           |
| Attempts Batch                           | 已实现                    | 只支持 4 种汉字题型，且依赖单个 lesson 的 `content_spec` |
| 离线 Outbox                              | 已实现基础                | 当前主要围绕 demo；真实计划/内容拉取链路未完整闭合       |
| Review Center API 8.2A                   | 已实现于快照              | 总体安全，但需要若干模型和分页优化                       |
| 复习移动端页面                           | 占位                      | 未实现                                                   |
| 标准书写                                 | 部分实现                  | 只有 3 个汉字有离线笔顺资源                              |
| 个人签名风格                             | 部分实现                  | 目前是简单坐标变换，不是成熟签名设计系统                 |
| 签名一致性                               | 部分实现                  | 指标较粗，只适合轻量反馈，不能过度宣传                   |
| 幽默内容                                 | 有 6 条审核内容和偏好设置 | 尚未接入真实课程渲染链路                                 |
| 繁体中文 / English UI                    | 只有设置项                | 没有真实 i18n 资源和界面切换                             |
| 数据导出                                 | 缺失                      | 公开发布前应补                                           |
| 删除账号                                 | 缺失                      | **商店发布阻塞项**                                       |
| 时区                                     | 缺失                      | 会影响“今日”、周统计和复习边界                           |
| 内容管理后台                             | 只有 shell                | 不应对外宣称已完成                                       |
| 生产课程发布/导入                        | 未看到完整链路            | 空数据库或新环境可能没有正式可学课程                     |

---

# 4. P0：公开发布前必须解决的问题

## P0-1：正式学习流程仍然是本地 Demo

### 证据

- `apps/mobile/src/app/(tabs)/index.tsx:8-18`
  - “继续学习”固定执行 `router.push('/demo-course')`。
- `apps/mobile/src/app/demo-course.tsx:87-158`
  - 明确写着“8 分钟离线演示课”“我的家”。
- `apps/mobile/src/app/demo-course.tsx:100-109`
  - 固定缓存 `home-demo-1.0.0`。
- `apps/mobile/src/features/offline-course/recovery.ts`
  - 仍围绕固定 Demo Session 恢复。
- `docs/PRODUCT_TECH_DESIGN.md`
  - 文档本身承认本地 demo 和真实服务器 session 并不是同一个闭环。

### 问题

当前真实 API 已经可以创建 `learning_sessions`，但移动端学习首页没有：

1. 请求 `/api/session-plan`；
2. 下载或读取计划对应的不可变练习内容；
3. 用统一 Runner 渲染每个 activity；
4. 生成正式 `AttemptDraft`；
5. 通过 Outbox 同步；
6. 完成 Session；
7. 回到首页更新进度。

### 建议

在复习 UI 之前，先补：

- `Task 8.2C — Session Plan V2 与 Session 生命周期`
- `Task 8.2D — 通用移动端 Session Runner`

否则“开始复习”没有可靠的可执行目标。

---

## P0-2：Session Plan 与 Attempts Batch 的内容模型不一致

### 证据

`packages/contracts/src/session-plan.ts:19-55` 中，每个计划 activity 只有：

- `candidateId`
- category
- domain
- skill type
- predicted success
- target concept IDs

没有：

- 可渲染题型 payload；
- immutable content version；
- exercise ID 与内容包 hash；
- 题目选项、音频、答案和提示引用。

`apps/api/src/routes/session-plan.ts:120-135` 将整个计划写入一个 `learning_sessions` 记录，并只保存一个 `lesson_id`。

`apps/api/src/session-plan-service.ts:330-336` 使用：

```text
lessonId = concepts.rows[0]?.lesson_id
```

但计划候选可能来自：

- 多个 lesson；
- 静态拼音内容；
- 不同 concept type。

`apps/api/src/attempts-batch-service.ts:239-249` 在校验作答时只读取：

```text
learning_sessions.lesson_id
→ lessons.content_spec
```

然后只从这个单一 lesson 中找到 exercise。

### 风险

真实 session-plan 选中的 activity 如果不属于第一个 lesson，提交后可能得到：

```text
ACTIVITY_NOT_FOUND
```

静态拼音候选也没有对应的 lesson `content_spec`，因此无法走现有服务端校验。

### 建议

Session Plan V2 必须保存不可变内容快照，至少包括：

```ts
type PlannedActivity = {
  activityId: string;
  exerciseType: string;
  contentVersion: string;
  payload: RenderableExercisePayload;
  targetConcepts: TargetConceptRef[];
  scoringPolicyVersion: string;
};
```

也可以保存 `contentRef + packageVersion + hash`，但必须保证：

- 移动端能离线重放；
- 服务端能用同一个版本重新校验；
- 课程发布新版本后，进行中的 Session 不会失效；
- 一个 Session 不再错误依赖单个 `lesson_id`。

---

## P0-3：拼音是演示功能，还不是一级“学习能力”

### 已有优点

- 六种题型组件已经存在；
- 拼音音频资源有基本 attribution；
- 自适应显示和 evidence weighting 算法已有测试；
- session planner 能混入拼音候选。

### 关键缺口

#### 1. 共享正式 Exercise 合同没有拼音题型

`packages/contracts/src/exercise.ts:200-205` 的 `LearningExerciseSchema` 只包含：

- `audio_to_glyph`
- `glyph_to_image`
- `word_build`
- `sentence_order`

没有六种拼音 Exercise。

#### 2. 服务端 Attempt Processor 不支持拼音

`apps/api/src/attempt-processing.ts:18-27` 只定义四种汉字技能。

#### 3. 数据库 Skill / Concept 枚举没有完整拼音领域

`database/migrations/0001_hanziquest.sql:5-10`：

- `skill_type` 没有 `audio_to_pinyin`、`tone_choice` 等；
- `concept_type` 只有 character / word / sentence / story；
- 没有 initial / final / syllable / tone 的正式持久化模型。

#### 4. 拼音 Tab 是一页 Demo

`apps/mobile/src/app/(tabs)/pinyin.tsx`：

- 直接导入 `ma2.mp3`、`ma3.mp3`、`ma4.mp3`；
- 在同一页渲染六个 demo exercise；
- 没有创建正式 Session；
- 没有写入 Outbox；
- 没有形成拼音掌握度和复习计划。

### 建议

拆为三个任务：

1. `Task 5.9P-A — 拼音持久化领域模型`
2. `Task 5.9P-B — 六种拼音服务端校验和 Attempts`
3. `Task 5.9P-C — 拼音接入通用 Session Runner`

完成后，拼音才可以真实进入：

```text
作答 → 证据 → 掌握度 → due_at → 复习中心 → 下一次 Session
```

---

## P0-4：Review Center 不能只做展示，必须接入真实 Review Session

8.2A 已经提供只读列表，但当前 `SessionPlanRequestSchema` 没有：

```ts
intent: 'learn' | 'review';
```

发布清单也明确承认：

> current session-plan contract does not support review intent

### 建议

不要让 8.2B 在移动端根据 Review Center 返回的 preview items 自己拼 Session。

正确链路应是：

```text
GET /api/review-center
    ↓
用户看到摘要
    ↓
POST /api/session-plan { intent: "review" }
    ↓
服务器按权威 review_schedule 创建不可变计划
    ↓
通用 Session Runner 完成练习
    ↓
Attempts Batch 更新 skill/review 状态
    ↓
Session Complete
    ↓
Review Center 刷新
```

---

## P0-5：没有 Session 生命周期完成接口

数据库有：

```text
planned
in_progress
completed
abandoned
```

但当前代码中：

- `/api/session-plan` 只创建 `planned`；
- `/api/attempts-batch` 允许 planned/in_progress 接受作答；
- 未发现正式 start / complete / abandon route；
- 没有完成后统计和清理逻辑。

### 建议

增加：

```text
POST /api/sessions/:id/start
POST /api/sessions/:id/complete
POST /api/sessions/:id/abandon
GET  /api/sessions/active
```

要求：

- 幂等；
- Session 必须归当前用户；
- 完成不能重复计数或重复发奖；
- 离线重放不会二次完成；
- completed/abandoned Session 拒绝新 attempt；
- active Session 可跨设备恢复。

---

## P0-6：账号删除和数据导出缺失

### 代码现状

`apps/mobile/src/app/(tabs)/me.tsx:62-108` 目前只有：

- Profile 信息；
- 幽默偏好；
- 编辑设置；
- 退出登录。

没有：

- 删除账号；
- 导出数据；
- 清除本地书写数据；
- 查看隐私政策；
- 数据保留说明。

`docs/release/PRIVACY_NOTICE.md:39-45` 只说通过 support channel 请求删除。

### 发布影响

HanziQuest 支持应用内创建账号，因此公开商店发布不能把“给客服发邮件”作为唯一删除路径。

### 必做功能

1. App 内“删除账号”入口；
2. re-auth / 二次确认；
3. 服务端删除 Better Auth 用户和所有级联业务数据；
4. 删除或隔离后台备份中的数据并明确保留期；
5. 清除 SecureStore、SQLite、Web localStorage、Outbox、Writing Draft；
6. 增加 deletion tombstone，阻止旧离线事件在删除后重新创建状态；
7. Google Play 所需的外部删除网页或表单；
8. 数据导出 JSON/ZIP；
9. 更新隐私政策和商店声明。

---

## P0-7：本地化设置与实际能力不一致

### 证据

`apps/mobile/src/app/onboarding.tsx:75-92` 允许选择：

- `zh-CN`
- `zh-TW`
- `en-US`
- simplified / traditional

`docs/release/STORE_METADATA.md:15-16` 也声明三种界面语言。

但是运行时代码：

- 大部分界面文案直接硬编码为简体中文；
- 没有 i18n 资源目录；
- 没有 locale provider；
- 没有英文或繁体 UI message catalog。

### 两种可选方案

#### 快速 Alpha

- V1 首发只保留 `zh-CN` 界面；
- 移除 onboarding 中假的 locale 选择；
- 商店资料不声明 zh-TW 和 en-US；
- script preference 可以保留，但仅控制课程字形。

#### 正式公开 V1

实现真实 i18n：

- `zh-CN`
- `zh-TW`
- `en-US`

并测试：

- 所有页面；
- 错误状态；
- 无障碍标签；
- 商店截图；
- 动态字体；
- 文案长度。

---

## P0-8：生产课程内容发布/导入链路不完整

数据库有课程表和发布状态，测试中也会插入 fixture；但仓库中没有看到一个明确、可重复执行的生产流程来保证新环境一定拥有：

- published curriculum version；
- worlds / units / lessons；
- lesson concepts；
- audio/image assets；
- content manifest；
- immutable package hash。

如果生产数据库只跑 migration，而没有正式 seed/import，`session-plan` 会返回：

```text
SESSION_CONTENT_UNAVAILABLE
```

### 建议

增加：

```text
packages/curriculum/releases/v1.0.0/
scripts/publish-curriculum.mjs
scripts/verify-curriculum-release.mjs
```

发布过程应：

1. 验证内容；
2. 生成 manifest 和 hash；
3. 导入 staging；
4. 跑 smoke session；
5. 只在全部通过后标记 published；
6. 已发布版本不可原地修改。

---

# 5. 8.2A 专项审计

## 做得好的地方

### 1. 身份边界正确

`apps/api/src/routes/review-center.ts:39-64`：

- 必须有有效 Session；
- 用户 ID 从 Session 推导；
- 不接受客户端 user_id；
- 使用 `withUserTransaction` 强制 RLS 上下文。

### 2. 合同严格

`packages/contracts/src/review-center.ts`：

- 请求、Cursor、响应都有版本；
- Zod 使用 strict；
- page size 有上限；
- group count 和 summary 有一致性验证；
- 返回安全展示字段，不包含答案或 mastery 权重。

### 3. 只读边界清楚

当前 route/service 没有写学习状态，文档和测试也覆盖了 read-without-write。

### 4. 发布内容过滤

SQL 将 review schedule 与已发布课程对象关联，避免未发布内容进入用户界面。

---

## 8.2A 建议优化

### A. Offset Cursor 不适合动态列表

`ReviewCenterCursorPayloadSchema` 保存：

```text
generatedAt + offset
```

服务端每次又重新从当前数据库计算整套结果。

如果分页过程中：

- 有新 attempt；
- due_at 被更新；
- 课程发布版本变化；
- confusion 状态变化；

Offset 可能跳过或重复项目。

#### 建议

改为 keyset cursor，至少包含：

```ts
{
  (generatedAt, lastPriority, lastDueAt, lastReviewKey);
}
```

并使用稳定 SQL 排序。

对于 V1 小规模用户，Offset 可以暂时保留，但必须：

- 标明 alpha 限制；
- 页面请求期间冻结 `generatedAt`；
- 增加 mutation-between-pages 测试；
- 不把它宣传为强一致分页。

### B. 一次读取最多 5001 行再在内存去重分页

`apps/api/src/review-center-service.ts:15`：

```text
MAX_REVIEW_SOURCE_ROWS = 5000
```

SQL 到 `:435-440` 先把所有 source rows 拉到 Node，再处理。

#### 建议

把以下逻辑尽量下推 PostgreSQL：

- due now 过滤；
- stable dedupe；
- priority；
- group aggregate；
- keyset limit。

避免一个活跃用户复习历史增长后触发 503。

### C. 只使用最新 Curriculum Version

SQL 选择 newest published curriculum。这样新版本发布后，旧版本中用户正在复习的合法概念可能突然从 Review Center 消失。

#### 建议

定义明确策略：

- 当前 active curriculum；
- 进行中 Session 的 pinned curriculum；
- 可迁移概念 ID；
- 旧内容 retirement mapping。

至少不能只用“最新发布时间”隐式决定用户全部复习内容。

### D. 去重粒度可能过粗

当前逻辑会按 `contentRef` 折叠。有些用户可能需要同一个汉字的：

- 认字复习；
- 听音选字；
- 拼音依赖复查；

如果全部折叠成一个 preview，可能隐藏不同技能。

#### 建议

区分：

```text
同一 content + 同一 learning objective：可去重
同一 content + 不同 skill evidence：应保留或合并为 multi-skill item
```

### E. `glyph_to_sound` 直接等于 `pinyin_dependency` 不准确

`review-center-service.ts:353-365` 把所有 `glyph_to_sound` 都映射为：

```text
kind = pinyin
reason = pinyin_dependency
```

但“需要复习字音”不等于“用户过度依赖拼音提示”。

真正的 pinyin dependency 应来自：

- hint evidence；
- revealed/visible rate；
- independent recognition 差距；
- 专门算法标记。

### F. Tone Group 目前无法产生真实数据

合同声明有 `tone` group，但数据库 skill enum 和 attempts processor 没有 tone skill。因此该组在实际使用中会长期是 0。

### G. Story 被归为 Sentence

当前 `case` 的 fallback 将 story 归入 sentence。可以接受，但应在合同和文档中明确，或正式增加 reading/story group，避免含义模糊。

---

# 6. P1：重要产品与体验优化

## P1-1：课程内容仍偏低龄，不匹配 13+ / 成人

`packages/curriculum/src/fixtures/home-demo-curriculum.ts` 仍包含：

```text
ageBand: "5-6"
```

“我的家”示例句和故事整体明显偏儿童。

### 建议的 13+ / 成人主题

- 家庭群聊；
- 餐馆点餐；
- 机场和火车站；
- 手机通知；
- 学校与大学；
- 工作和同事；
- 运动、音乐、游戏和电影；
- 旅游；
- 节日和亲属交流；
- 社交媒体和短消息；
- 表格、菜单、路牌和公告。

幽默应偏“轻松、聪明、情景反差”，而不是幼儿卡通感。

---

## P1-2：幽默偏好已存在，但真实课程没有消费它

仓库有：

- `approvedHumorContentFixture`
- `humorPreference`
- selector 和 validator
- 6 条已批准内容

但没有看到真实 lesson runner 导入并根据 Profile 选择：

```text
neutralFallback / light / playful
```

### 建议

在内容解析层加入：

```ts
resolveLessonCopy({
  lessonContentVersion,
  itemId,
  scriptPreference,
  humorPreference,
});
```

要求：

- 正确答案永远不变；
- learning target 永远不变；
- offline 可用；
- 找不到批准版本时 fail closed 到 neutral；
- 不能让 UI 直接自行拼笑话；
- 用户切换偏好后只影响新打开内容，不改变进行中 Session 快照。

---

## P1-3：诊断算法没有进入产品流程

`packages/learning-engine/src/diagnostic.ts` 有完整算法，但 onboarding 保存 Profile 后直接进入首页。

### 建议

新增：

```text
Task 8.3D — 诊断 UI、结果持久化和起点应用
```

流程：

```text
Profile 设置
→ 可跳过的低压力诊断
→ 结果摘要
→ 保存 axis estimate + confidence + algorithm version
→ session planner 使用推荐起点
```

如果用户跳过，定义确定性默认路径，并在前 3 节课中做隐式定位。

---

## P1-4：书写模块只有 3 个字有正式笔顺资源

`packages/curriculum/src/writing.ts:53-57` 只有：

- 家
- 王
- 豪

绝大多数用户姓名都会出现“不支持”。

### 建议

公开发布前至少选择一种策略：

#### 策略 A：扩大离线字库

准备常见姓氏和名字用字的笔顺包，例如首批 300–500 字。

#### 策略 B：诚实降级

把功能名称改为：

> 中文名字书写与风格预览

明确说明：

- 支持字可学习标准笔顺；
- 其他字只能自由书写；
- 不声称全部姓名都有标准指导。

同时保留用户原样输入的中文名，不要因简繁体偏好静默转换。

---

## P1-5：签名“设计”目前只是几何变换

`signature-transform.ts:26-41` 的四种风格主要是：

- 横向压缩；
- 前倾；
- 小幅正弦位移。

这更像“笔迹风格预览”，不是完整的个人签名设计。

### 建议

两种选择：

1. V1 改名，避免过度承诺；
2. 实现真正的确定性模板系统：
   - 多字布局；
   - 大小层级；
   - 字间连接建议；
   - 起止方向；
   - 单字简化规则；
   - 每种模板可重复生成；
   - 不模仿真实人物签名。

一致性分数也应被描述为“练习间相似度”，不能描述为书法质量或签名真实性。

---

## P1-6：拼音课程缺少变调教学策略

已有声母、韵母、五声、轻声和 `ü/v` 基础，但应明确区分：

```ts
canonicalPinyin; // 词典读音
surfacePinyin; // 实际语流读音
```

首批应覆盖：

- “一”的变调；
- “不”的变调；
- 三声连读；
- 常见轻声；
- 多音字在词语语境中的读音。

不要依赖简单字符串规则自动生成全部 surface reading；应使用人工审核的词语/句子音频和读音数据。

---

## P1-7：时区模型缺失

Profile 没有 IANA 时区，但产品使用：

- 每日目标；
- 今日复习；
- 周学习天数；
- 连续学习；
- next due。

### 建议

增加：

```sql
time_zone text not null
```

例如：

```text
America/Los_Angeles
Europe/London
Australia/Sydney
```

原则：

- 事件和 `due_at` 保存在 UTC；
- “今天/本周”按用户 IANA 时区计算；
- 旅行或修改时区要有防止重复计数的规则。

---

# 7. P2：工程质量与维护优化

## P2-1：API 运行时加固

建议检查并补齐：

- CORS 对未知 Origin 明确拒绝，而不是返回一个默认允许 Origin；
- request body size；
- rate limiting；
- request timeout；
- security headers；
- `/ready` 数据库就绪检查；
- graceful shutdown；
- PostgreSQL Pool 总连接预算；
- SMTP transport 复用和超时；
- structured logging 和 request ID；
- 移动端 API client AbortController；
- 有界重试和退避；
- 根同步 `.catch(() => undefined)` 不应静默吞错。

---

## P2-2：数据库完整性

需要明确或改进：

- `words.character_ids` 等 UUID 数组没有 FK；
- `lesson_concepts.concept_id` 是多态引用，没有数据库级完整性；
- 文档宣称 prerequisites，但 Schema 没有正式 prerequisite graph；
- `skill_states.next_review_at` 与 `review_schedule.due_at` 双重权威；
- `reward_balances` 若没有产品用途，应删除或移出 V1；
- 客户端 `occurredAt` 应限制时钟偏差，防止未来时间把复习推迟很久；
- 删除账号后应拒绝旧 Outbox；
- 文档宣称多设备 pull sync，但代码主要是 push attempts，需补真实 pull 或修正文档。

---

## P2-3：移动端生产界面清理

- Tabs 只有文字，建议增加图标和明确 selected state；
- 首页需要今日目标、复习数量、最近进度和同步状态；
- 拼音页面应改成课程/Session，而不是一页六个 Demo；
- “我的”应加入隐私、帮助、导出、删除账号和清除本地书写数据；
- showcase 路由应仅在 development build 存在；
- App icon / splash 应确认不是 Expo 模板资产；
- Admin 只是 shell，不应纳入“V1 功能完成”的对外说明；
- 删除误入仓库的 `apps/admin/tsconfig.tsbuildinfo`。

---

## P2-4：文档清理

### 需要修正

1. `docs/ADR/0001-versioned-api-contracts.md`
   - 仍使用 `child-safe`、`childMessage`。
2. `packages/contracts/src/error.ts`
   - 仍有 `childMessage` 字段。
3. `packages/contracts/README.md`
   - 仍描述 child UI。
4. `docs/CODEX_IMPLEMENTATION_PLAN.md`
   - 仍说数据库使用 `child_id`，与当前现实不符。
5. `VALIDATION_REPORT.md`
   - 数字和架构明显早于当前快照，应归档或更新。
6. 根目录旧指针文件
   - 应明确只作为 superseded pointer，避免 Codex 读取错误基线。

建议将 `childMessage` 改为：

```text
userMessage
safeMessage
localizedMessageKey
```

并通过 ADR 修订说明。

---

# 8. 推荐开发顺序

## 现在

Codex 先完成 8.2A，停止，不 push。

## 接下来不要直接执行原 8.2B

建议顺序：

1. **Task 8.2C — Session Plan V2 与 Session 生命周期**
2. **Task 5.9P-A — 拼音持久化领域模型**
3. **Task 5.9P-B — 拼音服务端校验与 Attempts**
4. **Task 8.2D — 通用移动端 Session Runner**
5. **Task 5.9P-C — 拼音接入 Runner 和正式学习流程**
6. **Task 8.2B-R — 移动端 Review Center**
7. **Task 8.3A — 账号删除、数据导出和本地清理**
8. **Task 8.3B — 本地化范围修正或完整 i18n**
9. **Task 8.3C — 13+ / 成人课程和幽默接入**
10. **Task 8.3D — 诊断产品化**
11. **Task 8.3E — 生产课程发布/导入**
12. **Task 8.3T — 时区和日历边界**
13. **Task 9.5R — 完整发布审计**

---

# 9. 8.2A 完成后的审批清单

收到 Codex 8.2A 报告后，确认：

- [ ] API 从 Session 获取 user ID。
- [ ] 不接受客户端 user_id。
- [ ] GET 不产生写入。
- [ ] 跨用户测试真实通过。
- [ ] 未发布内容被过滤。
- [ ] 同一 review objective 不重复。
- [ ] Cursor 行为有 mutation-between-pages 测试。
- [ ] 5000 行容量边界被记录。
- [ ] Tone group 当前无法产生数据的问题被明确列为后续依赖。
- [ ] `pinyin_dependency` 没有被错误等同于所有 glyph_to_sound。
- [ ] 文档明确 session-plan 仍没有 review intent。
- [ ] 没有擅自开始 8.2B。
- [ ] 没有 commit/push。

---

# 10. 建议直接发给 Codex 的下一条指令

```text
Task 8.2A 完成后停止。不要开始原 Task 8.2B，也不要 commit 或 push。

我对全仓做了产品与代码审计。当前真正的发布阻塞不是单独缺一个复习页面，
而是 server-created session、renderable exercise content、Pinyin attempts/mastery、
session lifecycle、mobile runner 和 review execution 尚未形成完整闭环。

请先进入 Plan mode，只执行：

Task 8.2C — Session Plan V2 与 Session 生命周期

目标：
建立一份能够被移动端离线渲染、也能被服务端权威校验的不可变 Session Snapshot，
并增加 start / complete / abandon / active-session 生命周期。

硬性要求：

1. SessionPlanRequest 新增 intent:
   - learn
   - review

2. review intent 必须从服务器权威 review_schedule / skill state / confusion state 选题，
   不能接受客户端传入复习项目列表，不能在移动端自行拼计划。

3. 每个 Planned Activity 必须绑定可渲染、版本化、不可变的内容：
   - activityId
   - exerciseType
   - contentVersion
   - contentRef 或完整 payload
   - target concepts
   - scoringPolicyVersion
   - audio/asset references
   - pinyin support decision

4. 进行中的 Session 不得依赖课程表当前最新内容。
   发布新课程版本后，旧 Session 仍可完成和服务端重放。

5. 修复当前一个 Session 只保存一个 lesson_id、但计划可能跨多个 lesson
   和静态 Pinyin 候选的问题。

6. Attempts Batch 必须根据 Session Snapshot 校验 activity，
   不能只通过 learning_sessions.lesson_id -> lessons.content_spec 找题。

7. 增加：
   - POST /api/sessions/:id/start
   - POST /api/sessions/:id/complete
   - POST /api/sessions/:id/abandon
   - GET /api/sessions/active

8. 所有 mutation：
   - Session-derived user identity
   - forced RLS
   - idempotent
   - cross-user denied
   - completed/abandoned session cannot accept new attempts
   - offline replay cannot complete twice

9. 本任务不实现移动端 UI，不新增 AI，不实现订阅，不实现家长/儿童模型。

10. 保留 Task 3.x 学习算法纯函数，不在 API 复制第二套规划算法。

测试至少覆盖：

- learn/review intent
- immutable content snapshot
- curriculum version changes during an active session
- multi-lesson activity plan
- Pinyin candidate content binding
- start replay
- complete replay
- abandon replay
- cross-user denial
- completion after offline attempt sync
- completed session rejecting new attempts
- fixed seed determinism
- no database write in read-only endpoints
- full Task 3.x / 4.x regression

开始前记录 git status、diff stat、branch 和 HEAD。
禁止 git reset --hard、git clean、远程数据库重置和自动 push。

完成后停止并报告：
1. 新合同；
2. 数据迁移；
3. API；
4. Attempts Batch 改动；
5. 所有实际运行测试；
6. 回滚方案；
7. 下一步唯一建议任务。

不要自动开始 5.9P-A 或移动端 8.2B。
```

---

# 11. 发布策略建议

## 可较快发布给内部测试者

可以将当前版本定义为：

```text
0.1 Closed Alpha
```

条件：

- 不在商店公开宣传为完整自适应课程；
- 只邀请测试用户；
- 说明“学习和拼音当前为演示内容”；
- 只承诺 zh-CN；
- 不处理真实敏感签名用途；
- 开启崩溃和错误收集时重新做隐私审查；
- 不把 release checklist 的自动测试等同于完整用户验收。

## 公开 V1

至少完成本报告 P0 项目后再考虑。

---

# 12. 最终判断

项目的底层架构方向是正确的，Codex 在以下方面表现很好：

- 设计约束执行力；
- 单用户安全模型；
- RLS 和幂等；
- 算法纯度；
- 合同和测试；
- 原始书写隐私；
- 去除 AI 运行时；
- 8.2A 的只读认证边界。

下一阶段不应继续以“把页面补齐”为中心，而应围绕：

> **把真实学习 Session 从服务器计划一直贯通到移动端完成、离线同步、掌握度更新和复习再计划。**

这条闭环一旦完成，HanziQuest 才从“很多优秀组件的集合”变成真正可持续学习的 App。
