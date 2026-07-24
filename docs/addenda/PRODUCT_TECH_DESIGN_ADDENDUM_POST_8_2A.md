# HanziQuest V1 产品与技术补充设计 — Post-8.2A

**状态：** 补充基线，取代原计划中 `8.2A → 8.2B → 9.5R` 的直接发布路径。
**不取代：** 单用户、无 AI、拼音、书写、幽默的既有产品决策，以及已经验收的底层算法和 8.2A 只读边界。
**产品阶段重新定义：** 当前为 Closed Alpha。只有完成本文件的 P0 发布门槛后，才可以称为 Public V1 Release Candidate。

---

## 1. 为什么需要补充设计

当前仓库已具备认证、Profile、强制 RLS、学习算法、Session Plan V1、Attempts Batch、离线 Outbox、六种拼音组件、书写画布、签名元数据和 Review Center API，但生产用户的主要路径仍然进入固定 Demo。最重要的缺口是：

```text
计划什么
≠ 移动端真正展示什么
≠ 服务端能够验证什么
```

`session-plan` 可以选择多个 Lesson 和拼音候选，`attempts-batch` 却只从 Session 的单一 `lesson_id` 读取 `content_spec`。因此真实计划中的部分 Activity 可能无法提交，拼音也无法进入正式掌握度和复习。

本补充设计优先闭合学习循环，再处理公开发布的隐私、内容和本地化门槛。

---

## 2. V1 成熟度门槛

### 2.1 Closed Alpha

允许：

- 本地或测试账号；
- 开发 Route 和有限课程；
- 无签名构建；
- 手工数据库 Seed；
- 部分本地化；
- 已知功能缺口明确标记。

不得宣称：

- 已具备正式自适应学习闭环；
- 拼音已经影响服务端掌握度；
- 可以公开商店发布；
- 所有中文姓名都有标准笔顺；
- 三种界面语言均已支持。

### 2.2 Public V1 Release Candidate

必须同时具备：

1. 正式 learn Session 闭环；
2. 正式 review Session 闭环；
3. 六种拼音题型的服务端评分、Evidence、Mastery 和 Review；
4. 生产 Curriculum Release 导入；
5. 首页不再进入 Demo；
6. 账号删除与数据导出；
7. 真实支持的 UI locale 与商店声明一致；
8. 用户时区边界；
9. 诊断结果能够影响起点；
10. 中文姓名书写范围诚实且可测；
11. 完整发布审计、签名构建和真机验证。

---

## 3. 正式学习闭环

```text
Authenticated user
  ↓
GET active session
  ↓ none
POST session-plan-v2 { intent: learn | review }
  ↓
Immutable Session + ordered Session Activities
  ↓
Mobile downloads bounded session snapshot
  ↓
Universal Session Runner renders exercises
  ↓
Attempt is saved locally with sessionActivityId
  ↓
Persistent Outbox syncs attempts-batch-v2
  ↓
Server re-evaluates immutable exercise snapshot
  ↓
Attempt Event + one-or-more Attempt Evidence rows
  ↓
Skill state / review schedule replay
  ↓
Complete session idempotently
  ↓
Invalidate learning home and review center
```

### 3.1 Demo 与正式路径

- `/demo-course`、`audio-to-glyph-showcase` 等 Route 保留为开发工具，但必须在生产导航中不可达。
- 首页“继续学习”必须调用正式 Session API。
- 拼音 Tab 应展示课程入口、掌握度或推荐练习，而不是把六个 Showcase 一次性堆在同一页面。
- 构建测试应扫描生产 Route 和按钮，禁止指向 Demo/Showcase。

---

## 4. Session Plan V2

### 4.1 请求合同

```ts
type SessionIntent = 'learn' | 'review';

type SessionPlanRequestV2 = {
  schemaVersion: 'session-plan-request-v2';
  clientSessionId: string;
  idempotencyKey: string;
  intent: SessionIntent;
  targetMinutes: number;
};
```

禁止客户端提交：

- `userId`
- mastery
- due items
- Review Center item IDs
- candidate IDs
- content version
- predicted success
- humor variant
- evidence targets

这些全部由服务器从当前用户 Profile、技能、复习、已发布课程和算法决定。

### 4.2 结果合同

```ts
type SessionPlanResultV2 =
  | {
      status: 'planned';
      session: SessionDownloadSnapshotV2;
    }
  | {
      status: 'nothing_due';
      intent: 'review';
      nextDueAt: string | null;
    }
  | {
      status: 'insufficient_safe_content';
      intent: SessionIntent;
      reasonCode: string;
    }
  | {
      status: 'active_session_exists';
      session: SessionDownloadSnapshotV2;
    };
```

不得创建空 Session。Review 无到期内容时返回 `nothing_due`。

### 4.3 Session Activity

每个 Activity 不是一个抽象候选，而是当前 Session 可离线执行的不可变实例：

```ts
type SessionActivitySnapshotV2 = {
  sessionActivityId: string;
  sourceExerciseId: string;
  position: number;
  exerciseType: LearningExerciseV2['type'];
  contentRef: string;
  contentVersion: string;
  contentSha256: string;
  exercise: LearningExerciseV2;
  evidenceTargets: EvidenceTargetV1[];
  pinyinSupport: PinyinSupportDecision | null;
  humorContentRef: string | null;
  estimatedSeconds: number;
};
```

`LearningExerciseV2` 包含移动端离线反馈所需的答案信息。HanziQuest 不是考试系统，允许登录用户在一个已创建、有限范围的 Session 中获得答案键；服务器仍必须重新评分，客户端正确性永远不可信。Review Center、课程目录和未开始的课程预览仍禁止返回答案。

### 4.4 内容固定

Session 创建时固定：

- Curriculum Version ID
- Curriculum manifest hash
- Humor package/version
- Algorithm versions
- Profile 的 script/locale/humor/pinyin 选择结果
- Activity 顺序
- Exercise payload
- Evidence targets
- Pinyin support policy

之后课程发布、Profile 修改或算法升级不能改变进行中的 Session。

---

## 5. Session 数据模型

建议新增下一组不可变迁移，预计从 `0007` 开始；实际编号以仓库为准。

### 5.1 learning_sessions 扩展

```text
intent                 learn | review
snapshot_schema_version
started_at
completed_at
abandoned_at
completion_idempotency_key
content_manifest_sha256
humor_content_version
```

现有 `plan` 可保留作为 Session Header/摘要；完整 Activity 使用独立表。

### 5.2 learning_session_activities

```text
id                     sessionActivityId
session_id
user_id
position
source_exercise_id
exercise_type
content_ref
content_version
content_sha256
exercise_snapshot      JSONB, strict contract
pinyin_support         JSONB nullable
evidence_targets       JSONB, strict contract
humor_content_ref      nullable
estimated_seconds
created_at
```

约束：

- `(session_id, position)` 唯一；
- `(id, session_id, user_id)` 唯一；
- `(session_id, user_id)` 复合外键指向 Session；
- `exercise_snapshot` 插入后不可修改；
- 强制 RLS；
- 当前用户只可读取自己的 Activity；
- 客户端不能直接插入或修改。

### 5.3 Session 状态转换

合法转换：

```text
planned → in_progress
planned → abandoned
in_progress → completed
in_progress → abandoned
completed → completed      幂等返回
abandoned → abandoned      幂等返回
```

禁止：

```text
completed → in_progress
abandoned → in_progress
completed/abandoned 后新增 Attempt
```

V1 同一用户最多存在一个 `planned | in_progress` Session。数据库用部分唯一索引防止多设备竞争；API 在冲突时返回现有 Active Session。

---

## 6. Attempts V2 与规范化 Evidence

### 6.1 Attempt 是事实事件

`attempts` 记录用户对一个 `sessionActivityId` 的一次提交：

- 选择或排序答案；
- 响应时间；
- retry/replay/hint/pinyin support；
- 设备时间和离线序号；
- 服务端评分结果；
- 幂等 ID。

不再通过 `lesson_id → content_spec` 找题。服务器从当前 Session Activity 的不可变 `exercise_snapshot` 评分。

### 6.2 一个 Attempt 可以产生多条 Evidence

新增 `attempt_evidence`：

```text
attempt_id
user_id
concept_type
concept_id
skill
ability_axis
correct
base_quality
support_multiplier
effective_quality
algorithm_version
created_at
```

主键至少覆盖：

```text
(attempt_id, concept_type, concept_id, skill, ability_axis)
```

这是拼音迁移题所必需。例如 `pinyin_to_glyph` 可以产生：

- 拼音识别 Evidence；
- 当前汉字识别 Evidence；
- 汉字 Evidence 因拼音显式存在而降低独立权重。

`skill_states` 和 `review_schedule` 从规范化 Evidence 稳定重放，不再依赖 `metadata.targetConceptIds` 的 JSONB 包含查询。

### 6.3 兼容迁移

- 现有 Attempt 不删除；
- 使用可审计脚本把当前主概念和 `metadata.targetConceptIds` 回填为 Evidence；
- 回填固定算法版本；
- 回填前后比较用户总曝光、正确数和 mastery fixture；
- 旧列先保留只读，完成双读验证后再决定未来清理；
- 不在同一 Task 中删除历史字段。

---

## 7. Session 生命周期 API

版本化接口：

```text
GET  /api/sessions/active
POST /api/sessions/:sessionId/start
POST /api/sessions/:sessionId/complete
POST /api/sessions/:sessionId/abandon
```

要求：

- 用户只来自 Better Auth Session；
- 不接受 `userId`；
- 所有 mutation 使用 idempotency key；
- start/complete/abandon 使用服务器 UTC 时间；
- complete 前至少每个 Activity 有一条服务器接受的 Attempt；
- 完成不要求每题答对，Session 完成不等于掌握；
- completed/abandoned Session 拒绝新 Attempt；
- Active Session 可跨设备恢复；
- 离线设备恢复后先同步 Outbox，再完成 Session。

---

## 8. learn 与 review 的规划差异

### learn

- 保留到期优先、先修约束、新概念 0–4、难度保护和高成功率收尾；
- 可以混入 Review、Transfer 和 New Content；
- 只选择当前 API/Runner 已正式支持的 Exercise Type；
- 若拼音服务端尚未完成，Planner 不得发出拼音 Activity。

### review

- 只从当前 `due_at <= now` 的权威 Review Schedule、混淆项和必要稳定性检查中选择；
- 不引入新概念；
- 不接受客户端传入 Review Center 条目；
- 同一目标可以选择不同的安全题型；
- 无到期内容时不创建 Session；
- Session 完成后 Review Center 必须刷新。

---

## 9. 拼音一级能力

### 9.1 数据模型

建议新增统一 `pinyin_concepts` 表：

```text
id
curriculum_version_id
concept_code
kind                   initial | final | syllable | tone
canonical_value
display_value
numbered_value
tone_number             0..4 nullable
initial_concept_id       nullable
final_concept_id         nullable
audio_asset_id           nullable
metadata
is_published
created_at
updated_at
```

`concept_type` 增加 `pinyin`。具体 kind 从 `pinyin_concepts.kind` 区分，避免枚举过度膨胀。

`skill_type` 增加：

```text
audio_to_pinyin
pinyin_to_audio
pinyin_to_glyph
glyph_to_pinyin
tone_choice
pinyin_syllable_build
```

### 9.2 课程读音

词语读音需要区分：

```text
canonicalPinyin  词典形式
surfacePinyin    实际语流形式，可选
audioAssetId
```

V1 不使用简单字符串规则自动推断所有变调。“一”“不”、三声连读和轻声优先使用人工审核的词语/句子音频与读音。

### 9.3 拼音 Session

六种拼音组件必须统一进入 Session Runner，并且：

- 产生正式 Attempt；
- 服务端重新评分；
- 产生规范化 Evidence；
- 更新 Pinyin Skill State；
- 生成 Review Schedule；
- 在 Review Center 中显示真实 `pinyin` 与 `tone` 分组；
- 可离线执行已下载 Session；
- 不录音、不评价口音。

---

## 10. Review Center

8.2A 保持只读。后续硬化包括：

1. 从 Offset Cursor 迁移到 Keyset Cursor；
2. 把到期过滤、稳定排序、去重和分页下推 PostgreSQL；
3. 明确 Active Curriculum 与历史 Session pinned curriculum 的关系；
4. 不把所有 `glyph_to_sound` 都误标为 `pinyin_dependency`；
5. Pinyin/Tone 数据完成后再保证相应分组非空；
6. 同一内容的不同学习目标可以合并为 multi-skill preview，但不能无条件折叠。

移动端复习页必须通过 `session-plan-v2 { intent: 'review' }` 开始复习，不得把预览条目变成客户端计划。

---

## 11. 移动端正式 Session Runner

### 11.1 数据层

- API 获取或恢复 Active Session；
- Session Snapshot 缓存按 `userId + sessionId + schemaVersion` 隔离；
- Snapshot 与 Attempt Outbox 在同一事务边界更新；
- 退出账号后不得显示上一账号 Session；
- Session Snapshot 损坏时隔离并重新拉取，不清除其他学习数据；
- 未下载 Session 时离线不能创建新计划，但可以继续已缓存 Session。

### 11.2 Runner 状态机

```text
loading
ready
answering
feedback
persisting_attempt
next_activity
sync_pending
completing_session
completed
recoverable_error
fatal_content_error
```

### 11.3 正式汉字题型

首先接入现有四种：

- `audio_to_glyph`
- `glyph_to_image`
- `word_build`
- `sentence_order`

然后接入六种拼音题型。所有题型使用同一 Runner Header、进度、提示、反馈、离线、恢复和无障碍框架。

---

## 12. 诊断产品化

`diagnostic-v1` 已有纯算法，但需要：

- Onboarding 诊断 UI；
- 静态审核的诊断题包；
- 暂停/恢复；
- 可跳过；
- 结果持久化；
- 起点和拼音模式应用。

Task 8.3D 已完成上述产品化：移动端使用固定 `diagnostic-content-v1.0.0` 题包和
`local-diagnostic-v1` 按用户保存暂停/离线进度；服务器使用 `diagnostic-run-v1`
认证接口与强制 RLS，只保存完成摘要或跳过标记。Planner 仅在尚无真实 Attempts 时
应用诊断先验；第一条真实 Attempt 后完全回到 Evidence。

建议新增 `diagnostic_runs`，只保存：

- user_id
- algorithm_version
- content_version
- started/completed/skipped
- result summary
- recommended starting point
- recommended pinyin mode

不保存原始语音。诊断结果只是初始先验，后续真实学习证据可以覆盖。

跳过诊断的默认路径：

- `pinyin_support_mode = adaptive`
- 从高频生活汉字与基础听音/声调混合单元开始
- 每关最多 2 个新概念
- 前 3 个正式 Session 继续做低压力隐式定位

---

## 13. 生产课程与幽默

### 13.1 Release Package

正式课程必须存在：

```text
packages/curriculum/releases/<version>/
  manifest.json
  curriculum.json
  media-manifest.json
  editorial-approval.json
```

脚本：

```text
scripts/verify-curriculum-release.mjs
scripts/import-curriculum-release.mjs
scripts/smoke-curriculum-release.mjs
```

Manifest 至少固定：

- version
- script track
- min app version
- file hashes
- media hashes
- humor package version
- Pinyin content version
- editorial reviewer/time
- migration map from previous version

### 13.2 公开 V1 内容最低目标

沿用产品最初 MVP 目标：

- 100 个高频汉字；
- 200 个常用词；
- 30 个日常句型；
- 10 个短故事；
- 完整基础拼音/声调训练；
- 13+ 与成人可接受的主题。

推荐主题：家庭群聊、餐馆菜单、交通、手机通知、学校/大学、工作、旅行、运动、音乐和社交消息。

### 13.3 幽默接入

幽默选择在 Session 创建时按 Profile 偏好确定并固定到 Snapshot：

- `off` → neutral fallback
- `light` → only approved light
- `playful` → approved light/playful

幽默不能改变学习目标、答案或证据。已发布文案变化必须提高内容版本并重新人工审核。

---

## 14. 中文姓名书写与签名范围

### 14.1 姓名数据

- 原样保存用户输入；
- 改变简繁体偏好不自动转换姓名；
- 多音字由用户确认当前读音；
- 不自动提供人格、命运或所谓姓名学解释。

### 14.2 笔顺资产

当前少量 Fixture 不足以支持公开功能。建立离线 `writing-assets-v1` manifest：

- 首批至少覆盖常见百家姓与常用名字字；
- 目标为前 100 个常见姓氏和至少 300 个常见名字字；
- 最终数量需在压缩包预算和真机性能下确认；
- 每个字记录来源、许可、hash 和数据版本；
- 不支持的字仍可自由书写与风格练习，但不显示猜测笔顺。

### 14.3 产品文案

称为“中文名字书写与风格练习”，不得宣传为：

- 专业签名设计；
- 书法评分；
- 身份验证；
- 真伪鉴定；
- 法律签名生成。

---

## 15. 本地化

界面语言和学习字形是两个独立设置。

公开 V1 最低支持：

- `en-US`：目标海外用户的主要解释界面；
- `zh-CN`：完整简体中文界面。

`zh-TW` 只有在全部页面、错误、无障碍标签和商店素材完成后才能出现在选择器；否则隐藏该选项，但可以继续支持 Traditional Script 学习内容。

所有生产文案进入统一 message catalog。课程中的目标中文不翻译成英文答案；说明、按钮、错误和无障碍标签随 UI locale 变化。

---

## 16. 时区与日历边界

Profile 增加 IANA `time_zone`，例如 `America/Los_Angeles`。首次运行从设备检测，用户可修改。

规则：

- 所有事件、Session、Attempt 和 due_at 保存 UTC；
- “今天”“本周”“连续学习”按用户时区计算；
- 时区变化只影响未来日历归属，不重写历史日报；
- Review `due_at <= now` 与时区无关，UI 只负责本地显示；
- 测试覆盖 DST、跨午夜、旅行改时区和无效时区回退。

---

## 17. 账号删除和数据导出

公开发布前提供：

```text
POST   /api/account/export
DELETE /api/account
```

或仓库命名规范下的等效版本化接口。

要求：

- 最近认证和二次确认；
- 删除 Better Auth 账号及级联业务数据；
- 撤销所有 Session；
- 清除 SecureStore、SQLite、Outbox、Web Storage、写字草稿和缓存；
- 旧设备事件不能在删除后恢复账号数据；
- Server Export 不包含原始本地笔迹；
- App 提供单独导出或删除本地书写轨迹；
- 提供公开网页删除入口/请求资源；
- 更新隐私和商店声明。

---

## 18. 明确不做

V1 继续不包含：

- 生成式 AI；
- 支付、订阅或 Premium；
- 语音识别和口音评分；
- 社交、排行榜、聊天；
- 家长/儿童/家庭模型；
- 专业书法或签名鉴定；
- 完整 CMS（版本化静态发布脚本足够）；
- 隐藏式成瘾机制或惩罚性断签。

---

## 19. 最终端到端验收

```text
注册/登录
→ 完成 Profile 与时区/语言设置
→ 完成或跳过诊断
→ 首页创建正式 learn Session
→ 完成汉字与拼音题
→ 离线保存 Attempt
→ 恢复网络并幂等同步
→ Session 完成
→ Skill/Review 状态更新
→ Review Center 出现真实到期内容
→ 创建 review Session
→ 完成复习并刷新数量
→ 练习自己姓名的标准书写/风格
→ 导出学习数据
→ 退出重登恢复进度
→ 删除账号并清理本地数据
```

任何一步仍依赖 Demo、占位页或手工数据库操作，都不能标记 Public V1 PASS。

### 实施检查点：8.2C-B

截至 2026-07-24，服务端已实现 `active-session-v1` 与
`session-lifecycle-v1`。每位用户最多一个 `planned | in_progress` Session；状态时间由
PostgreSQL 触发器生成，终态不可逆，幂等事件不可变且受强制 RLS 保护。该检查点没有把
Planner 切换到 V2，也没有实现移动端 Runner 或拼音服务端评分；这些仍由后续 Task
负责。

### 实施检查点：8.2C-C

截至 2026-07-24，`POST /api/session-plan` 已支持严格版本化的 learn/review V2 请求，
并返回 `planned | active_session_exists | nothing_due | insufficient_safe_content`。
服务端只从已发布且 hash 校验通过的 Active Curriculum Release 取材，复用纯学习引擎，
把完整 `LearningExerciseV2`、来源、版本/hash、Evidence Targets、Pinyin Support、
幽默偏好与预计时长原子物化为不可变 Activity Snapshot。当前正式 capability gate 只
允许四种汉字题型；拼音候选不会进入 Session。

无到期复习或安全内容不足时不会创建空 Session/Activity；为了让同一幂等 key 在权威状态
变化后仍返回首次结果，仅保存受 RLS 保护的不可变结果回执。移动端 Runner、Attempts V2
规范化 Evidence 和拼音服务端评分仍由后续 Task 负责。

### 实施检查点：8.2C-D

截至 2026-07-24，`POST /api/attempts-batch` 已按 `schemaVersion` 同时保留 V1 兼容分支
并支持 `attempts-batch-request-v2`。V2 每条事件只引用 `sessionActivityId`，服务端从当前
用户的不可变 `exercise_snapshot` 重新评分，不读取 Session 的单一 `lesson_id`，也不信任
客户端正确性。当前 capability gate 仍只启用四种汉字题；六种拼音题等待 5.9P-B。

迁移 `0010_attempts_v2_normalized_evidence.sql` 为一个 Attempt 保存一条或多条不可变
`attempt_evidence`，显式固定 `base_quality`、`support_multiplier`、`effective_quality`、
能力轴、概念、skill 和算法版本。Skill/Review 重放按设备时间、离线序号、Attempt ID 和
Evidence target key 稳定排序，不再依赖 `metadata.targetConceptIds` JSONB 扫描。历史
Attempt 的幂等回填保持有效 Evidence 质量，因此 mastery 与 review fixture 重放完全等价。

本检查点同时把 Session materializer 提升为
`pinyin-session-planner-v1+session-materializer-v2`：成功收尾候选必须重新计算且达到
预测成功率 `0.90`，避免高混淆内容因随机 ID 排序成为不安全收尾。移动端 Snapshot 缓存、
持久化 Outbox 和正式 Runner 仍由 8.2D-A/B 负责。

### 实施检查点：8.2D-A

截至 2026-07-24，移动端已建立不依赖 UI 的正式 Session 数据层。严格响应解析覆盖
Active Session、Session Plan V2 和 start/complete/abandon；本地 schema v3 按
`userId + sessionId + snapshotSchemaVersion` 隔离并保存 V2 Header、不可变 Activity
Snapshot 与引用 `sessionActivityId` 的 Attempt Outbox。

旧 Web schema v2、V1 Session 和 Demo 数据只进入 legacy bucket，不会被正式 V2 同步器
上传。服务器 Active/终态优先；遇到未同步 Outbox 时先同步或返回明确恢复选择，拒绝事件
保留供恢复而非静默丢弃。损坏 Snapshot 单独隔离，不删除其他用户或其他学习数据；相同
Session ID 的 Snapshot 内容变化会被拒绝。退出可按用户清理，本地读取也始终要求
`userId`。

本检查点没有替换首页、复习页或拼音页，也没有实现 Runner UI。正式四种汉字题型的通用
Runner 仍由 8.2D-B 负责；SQLite 真机进程死亡、磁盘异常和账号切换仍需在发布审计中做
物理设备验证。

### 实施检查点：8.2D-B

截至 2026-07-24，首页正式学习入口只进入 `/session`。入口优先恢复当前用户的 Active
Session；没有 Active Session 时才请求 learn intent 并启动计划。正式 Runner 只接受
`audio_to_glyph`、`glyph_to_image`、`word_build` 和 `sentence_order`，其余能力继续由
capability gate 拒绝。

每次作答均使用不可变 Activity Snapshot 做本地即时反馈，并把 Attempt V2 与
`completedActivityIds` 检查点原子写入按用户隔离的本地存储。网络可用时进行后台同步；
离线、进程重启或同步失败时保留 Outbox。Session 完成前必须先排空可同步 Attempt，再调用
服务端 complete 并失效 Active、Learn 和 Review 读模型。服务端仍是评分、Mastery、
Review Schedule 和 Session 终态的唯一权威；本地与服务端评分不一致时只记录安全机器码，
不记录答案或内容。

Demo 和 showcase 页面仅供开发构建使用，生产构建直接访问时返回首页。当前发布 Snapshot
只提供图片资源键而没有生产资源解析器，因此 glyph-to-image 暂以可访问性标签保留语义；
生产图片资产绑定由 8.3E 处理。Snapshot 缺少拼音展示文本时 Runner 不生成或猜测拼音，
完整拼音持久化和通用 Runner 由 5.9P-A 到 5.9P-C 处理。

### Implementation checkpoint: 5.9P-A

As of 2026-07-24, migration `0011_pinyin_persistence_domain.sql` establishes a formal, versioned
`pinyin_concepts` domain for initials, finals, tones, syllables, stable UUIDs, component references,
audio assets, and publication state. The runtime role reads published Pinyin content only, and
published concepts cannot be changed in place. The formal importer produces an approved,
runtime-invisible candidate with a stable mapping from
validated `pinyin-content-v1`, verifies the three bundled audio files against their SHA-256,
locale, license, and attribution, and is safe to repeat. Task 8.3E remains responsible for
atomically publishing a complete Curriculum release, so this importer cannot displace the current
active course by itself.

Word and sentence reading contracts now distinguish `canonicalPinyin` from optional
`surfacePinyin`; V1 does not guess complex tone sandhi.

### Implementation checkpoint: 5.9P-B

As of 2026-07-24, server planning and Attempts V2 support all six formal Pinyin exercise types.
Published lesson sources use `pinyin-lesson-exercise-v1`, which binds an immutable
`learning-exercise-v2` payload to explicit primary/secondary/transfer Evidence targets, a Pinyin
skill type, and the minimum `pinyin-exercises-v1` client capability. The API validates every target
against the published Curriculum and Lesson declarations before materialization.

`pinyin-scoring-v1` supplies explicit BKT parameters. Pinyin and tone axes retain full support
weight; Hanzi-dependent Evidence uses the existing none/visible/revealed/full-answer table, and
`pinyin_to_glyph` always treats its Hanzi target as Pinyin-supported rather than independent
recognition. Context-bound accepted readings handle polyphonic glyphs, and tone 5 is the explicit
neutral-tone value. Normalized Evidence drives the same deterministic Skill State and Review
replay path as Hanzi. Review Center resolves published Pinyin concepts into stable `pinyin` and
`tone` groups.

The server capability is open, but old clients remain safe: Session Plan V2 includes Pinyin
candidates only when the request declares `pinyin-exercises-v1`. At the 5.9P-B checkpoint the
mobile client did not declare it; Task 5.9P-C owned the later Runner rendering and capability
opt-in recorded below.

### Implementation checkpoint: 5.9P-C

As of 2026-07-24, the mobile client declares `pinyin-exercises-v1` when it requests a new formal
learn Session. The universal Runner is versioned as `formal-session-runner-v2` and accepts all ten
released Hanzi/Pinyin Activity types. Six pure Pinyin adapters preserve the existing accessible
exercise components while routing every answer through the same local checkpoint, immutable
Attempt V2, persistent outbox, server reconciliation, retry, restart recovery, and Session
completion flow.

Formal Pinyin audio resolves only reviewed bundled assets. The Runner prefetches every required
Pinyin clip once per immutable Activity `contentSha256`, permits offline replay, records repeat
evidence only after local playback preparation succeeds, and exposes a retry state when playback
or an asset binding fails. The app configuration continues to disable microphone permission,
background recording, voice capture, and upload.

The production Pinyin tab no longer renders six demos. It shows the current cached formal-Session
Pinyin progress, recommends continuing Pinyin or reviewing an unfinished tone Activity, and starts
the same `/session` route as Learn. Historical mastery presentation and the formal Review Center
remain owned by 8.2A-H and 8.2B-R; the tab does not create a client-side planner.
