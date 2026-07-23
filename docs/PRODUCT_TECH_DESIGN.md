# HanziQuest V1 产品与技术设计基线

状态：Task 5.1P 拼音内容领域与验证实现后的决策基线

目标用户：会说或听得懂一些中文、但不熟悉汉字阅读和书写的 13 岁以上海外华裔青少年及成人

替代范围：本文件替代旧版 Parent/Child/Household 和生成式 AI 产品设计。P1 已移除 AI
运行时、配置和数据库表面；2.2R 已用受保护的前向迁移建立单用户数据库；2.3R/2.4R
已将移动端迁移到单用户认证、首次设置、路由保护和年龄中性主导航。

## 1. 产品目标与边界

V1 帮助单个登录用户学习拼音、汉字识读、间隔复习和自己中文名字的规范书写与确定性签名
练习。界面使用年龄中性语言，不区分“儿童端”和“家长端”。

V1 不包含家庭、监护人、多个学习者、家长门、家长报告、生成式 AI、AI entitlement、
支付或订阅。未来 AI 方向只能记录在 `docs/backlog/FUTURE_PREMIUM_AI.md`，不得被 V1
运行时代码导入或引用。

## 2. 导航与首次使用

主导航：

- 学习
- 拼音
- 书写
- 复习
- 我的

首次使用：

```text
注册或登录
  → 创建一对一 profile
  → 设置界面语言和简繁体
  → 设置拼音辅助模式
  → 可选输入中文名字
  → 设置每日目标
  → 运行拼音与汉字诊断
  → 进入学习首页
```

不要求真实姓名、学校、精确生日、家长资料或家庭关系。

## 3. 单用户架构

```text
public."user" (Better Auth)
  └── profiles
        ├── learning_sessions
        ├── attempts
        ├── skill_states
        ├── review_schedule
        ├── confusion_stats
        ├── signature_projects
        └── signature_practice_summaries
```

`profiles.id = public."user".id`。所有私人业务表使用 `user_id uuid not null`。移动端只调用
Node API；API 从会话取得用户 ID，并在事务内设置 `app.current_user_id`。强制 RLS 使用该
事务身份执行跨用户隔离。客户端只可写允许的个人设置与不可变作答事件；掌握度、复习、
奖励和发布状态由服务端维护。

### 3.1 profiles

- `id`
- `display_name`
- `chinese_name`
- `interface_locale`
- `script_preference`
- `pinyin_support_mode`
- `humor_preference`
- `daily_goal_minutes`
- `created_at`
- `updated_at`

禁止添加 `child_id`、`learner_id`、`parent_id`、`household_id`、`family_id`、
`guardian_id`、`ai_enabled`、`ai_consent` 或 `premium_ai`。

### 3.2 学习记录

- `learning_sessions`：不可变计划快照、算法版本、目标时长、状态。
- `attempts`：客户端 UUID、会话、学习对象、技能、答案证据、提示、时间与幂等键。
- `skill_states`：多技能掌握度、稳定度、难度、下次复习和状态版本。
- `review_schedule`：到期原因、间隔、计划版本。
- `confusion_stats`：共享混淆 pair 与两个方向的机会/误选统计。
- 私人表的越权读取和写入必须有跨用户拒绝测试。

## 4. 认证与会话

使用 Better Auth 提供登录、注册、退出、邮箱确认、密码恢复、会话恢复和过期 session
处理；Expo 集成使用 SecureStore 保存安全会话。移动端使用 `AuthProvider`；登录成功后只加载同 ID 的 profile，不创建其他
用户实体，也不提供角色或学习者切换。状态流为 `unauthenticated →
authenticated_profile_loading → onboarding_required | ready → app`，profile 失败进入可重试
错误状态。

## 5. 学习领域

核心能力轴：

- `spoken_audio_comprehension`
- `pinyin_recognition`
- `tone_discrimination`
- `hanzi_recognition`
- `word_reading`
- `sentence_reading`
- `confusion_discrimination`

现有 BKT、质量归一化、遗忘/稳定度、相似字风险和 Task 3.4 会话规划器作为通用算法保留。
学习引擎是纯函数，不访问网络、数据库、UI 或 AI。

### 5.1 拼音

拼音是一等课程对象，不是汉字上方的装饰文本。模型至少表达：

- 声母、韵母、整体认读音节与合法组合
- 带调与数字调表示
- 轻声和变调的课程说明
- 音频、口形/发音提示和常见干扰项
- 拼音到音频、音频到拼音、拼音到汉字、汉字到拼音
- 声调选择和拼音音节拼装

拼音有独立掌握度、诊断、复习和淡出规则。使用拼音提示后答对仍是正确答案，但降低
`hanzi_recognition` 的独立证据权重；它可以增加受支持识别证据。

### 5.2 诊断 3.5R

新诊断替代原儿童诊断。它覆盖六个核心能力轴，优先使用音频、不依赖英语翻译，先进行
低压力定位，连续错误时停止向上探测，并设置题目和 5–7 分钟上限。输出各轴起点、
置信度、建议课程位置和首周节奏；不显示“差”“弱”“失败”等标签。固定 seed 可复现，
不调用网络或 AI。签名能力不进入入门诊断。

`diagnostic-v1` 已实现为可暂停的纯 TypeScript 状态机。调用方必须注入时钟和 RNG；
`createSeededRandom` 提供固定 seed 的参考实现。结果逐轴输出 `estimatedLevel`、
`confidence` 和 `observedEvidenceCount`，并输出 `recommendedStartingPoint`、
`recommendedPinyinSupportMode` 与机器码 `stopReason`。默认上限为 6 分钟、36 题和
连续 5 次错误；停止原因仅为 `confidence_reached`、`consecutive_errors`、`time_limit`、
`item_limit` 或 `content_exhausted`。

典型 fixture：

1. 听说好、不会拼音、识字弱。
2. 听说好、会拼音、识字弱。
3. 拼音好、汉字一般。
4. 汉字阅读较好。
5. 几乎零基础。

### 5.3 拼音辅助证据降权

`pinyin-evidence-v1` 将答案是否正确与证据强度分开处理：显示或揭示拼音后答对仍然是答对，
但 `hanzi_recognition`、`word_reading` 和 `sentence_reading` 的独立汉字证据依次降低。
无拼音辅助保持权重 `1.00`，始终可见拼音为 `0.75`，用户主动揭示拼音为 `0.45`，完整答案
揭示为 `0.10`。这些权重不降低听力、拼音识别或声调辨析证据。算法将输入质量限制在
`[0, 1]`，固定输入产生固定结果，并输出轴、辅助级别、基础质量、权重、降权后质量和版本。

### 5.4 会话规划

保留 Task 3.4 的到期优先、先修约束、新字 0–4 调速、固定 seed、最多两个连续高难活动
和高成功率收尾。3.7R 将拼音技能、拼音提示证据和对应题型接入候选池。

### 5.5 拼音内容契约与验证

`pinyin-content-v1` 是独立、版本化的静态内容包，不破坏现有课程包格式。它分别表达声母、
韵母、五个声调和音节，并以稳定 ID 连接音节与组成部分。`pinyin-normalization-v1` 将数字调、
声调符号、`v`/`u:` 输入和轻声确定性归一化，保留 `ü`，并拒绝不合法的普通话声韵组合或
冲突声调。

内容验证器检查重复 ID/值、完整五声表、声韵引用、合法组合、显示形式、声调一致性和可选
音频资产类型。默认内容验证同时覆盖现有演示课程和已审核的拼音 fixture。该任务不添加 UI、
网络、数据库或发音评分。

## 6. 中文名字书写与签名

### 6.1 标准书写

每个名字汉字依次学习拼音、标准笔顺、起笔位置、笔画方向、字形结构和比例，再从描写
过渡到自由书写。

```ts
type StrokePoint = {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number;
};

type Stroke = {
  points: StrokePoint[];
};
```

坐标归一化到统一画布空间，保证跨屏幕回放和比较。

### 6.2 个人签名

只围绕用户自己的中文名字，提供清晰型、紧凑型、前倾型、流畅型四种确定性布局和轨迹
变换。不得调用 AI、模仿真实人物签名、用于认证、验证真伪或作出身份声明。

原始轨迹和签名图片默认仅保存在本地。服务器 V1 最多保存：

- signature project metadata
- practice count
- score summary
- selected style

一致性反馈比较用户自己的多次练习，衡量结构、比例、方向和节奏的稳定性，不评价法律
签名真实性。

## 7. 静态幽默课程

用户偏好为 `off | light | playful`，默认 `light`。支持：

- `situational`
- `tone_wordplay`
- `character_dialogue`
- `exaggeration`
- `surprise_ending`
- `memory_scene`

每个幽默内容含 `humor_level`、`humor_type`、`neutral_fallback`、`learning_target`、
`locale` 和 `editorial_status`。验证器必须确保幽默版与中性版目标和正确答案一致，目标
拼音/汉字仍存在，不羞辱用户、不嘲笑错误、不含身份刻板印象或错误字源，记忆故事不冒充
正式字源，并且离线可用、不依赖 AI。

## 8. 离线、同步与幂等

内容包可离线读取。作答先写本地持久化 outbox；恢复网络后按不可变客户端事件 UUID
批量提交。服务端以 `(user_id, offline_event_id)` 去重，按状态版本处理并发和乱序。
多设备 pull sync 使用游标，不依赖内存队列。

## 9. 隐私与安全

- 收集最少个人资料；中文名字仅用于用户自己的学习。
- 不上传原始签名轨迹、签名图片或原始语音。
- 日志不含 token、完整私密文本、轨迹或音频。
- 所有私人数据以 API 会话身份和强制 PostgreSQL RLS 双层隔离。
- 外部链接、隐私和账号操作使用普通认证与近期认证，不使用家长门。
- 错误反馈支持性、年龄中性，不使用羞辱或儿童化措辞。

## 10. V1 明确禁止的 AI

不得存在模型供应商 SDK、AI Edge Function、AI prompt、生成、moderation、AI consent、
AI feature flag、AI usage、AI entitlement、AI quota、AI 测试 mock 或为未来 AI 预留的
运行时抽象。P1 已按审计清单移除这些遗留，并由 CI 执行运行时禁用项扫描。

## 11. 测试与发布门槛

- 领域算法：单元、边界、不变量和固定 seed 测试。
- 拼音：声韵调合法性、证据降权、诊断和淡出。
- API：成功、未认证、跨用户拒绝、无效输入、重复和重试。
- 数据库：标准 PostgreSQL 迁移、约束、跨用户 RLS 与回滚说明。
- 离线：重复、乱序、中断恢复和多设备游标。
- 书写：坐标归一化、本地持久化和不上传断言。
- 幽默：目标/答案一致、中性回退和安全规则。
- UI：加载、空、错误、离线、无障碍和年龄中性文案。

发布前必须确认仓库不含第一版禁止的家庭/儿童/家长或 AI 运行时内容，并完成性能、隐私、
无障碍、内容和商店检查。
