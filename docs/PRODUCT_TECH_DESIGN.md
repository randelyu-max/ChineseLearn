# HanziQuest V1 产品与技术设计基线

> **Post-8.2A 基线：** 本文件记录截至 Task 8.2A 的已接受设计。后续工作的权威增量设计是
> [`docs/addenda/PRODUCT_TECH_DESIGN_ADDENDUM_POST_8_2A.md`](addenda/PRODUCT_TECH_DESIGN_ADDENDUM_POST_8_2A.md)
> 及 ADR 0004-0006。旧版直接执行 8.2B/9.5R 的顺序与增量设计冲突时，以 Post-8.2A
> 整改顺序为准。

状态：Task 8.2A 只读复习中心 API 已完成；8.2B 移动端和 9.5R 发布审计复跑待执行

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
        ├── signature_practice_events
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

### 3.3 单用户会话计划 API

`POST /api/session-plan` 只接受严格版本化的 `clientSessionId`、`idempotencyKey` 和
`targetMinutes`，不接受 `user_id`、掌握度、复习状态或候选活动。API 从 Better Auth 会话
取得用户 ID，在 `hanziquest_app` 事务身份和强制 RLS 下读取 profile、已发布课程、技能状态、
复习计划和近期作答，再调用 `pinyin-session-planner-v1`。

服务端将完整的 `session-plan-snapshot-v1` 写入 `learning_sessions.plan`。同一用户的
`client_session_id` 和 `idempotency_key` 分别唯一；重试返回第一次保存的同一 session 与
同一快照，即使重试请求中的目标时长变化也不会重新规划。应用角色只有新增和读取权限，
数据库触发器禁止修改用户、客户端键、课程、时长、算法版本和计划快照。没有 profile 或
已发布课程时返回版本化的内容不可用错误，不会创建半成品 session。

### 3.4 只读复习中心 API

`GET /api/review-center` 只接受 `review-center-request-v1` 的 `schemaVersion`、可选 cursor 和
1–50 的 page limit；不接受 `user_id`。API 从 Better Auth session 取得用户身份，并在
`hanziquest_app` 事务与强制 RLS 下读取 `review_schedule`、`skill_states`、
`confusion_stats`、近期 attempts 摘要和当前已发布课程。

响应使用 `review-center-v1`，包含固定的 `hanzi | pinyin | tone | word | sentence |
confusion` 分组、到期/逾期汇总、确定性预计分钟数、下一到期时间、有限条目和
`review-center-cursor-v1` 分页。`due_at <= generatedAt` 属于当前到期；逾期、较早
`due_at` 和稳定 `reviewKey` 依次决定排序。数据库目前没有独立 review priority 字段，
因此 API 不创造第二套优先级。混淆 pair 优先替代涉及同一汉字的普通条目；同一概念不会
因多个来源重复计数。

读取不会创建 session、更新 due time、标记已查看、重算 mastery 或写入任何学习状态。
响应不包含用户 ID、正确答案、完整 attempt、mastery/内部权重或未发布内容。现有数据库
skill enum 只可把 `glyph_to_sound` 映射为拼音依赖复习，尚无独立声调/拼音复习持久化；
因此真实查询中的 `tone` 分组在 V1 当前数据模型下可能为空。移动端 Task 8.2B 开始前还
必须显式评审 `session-plan-request-v1` 的最小 review intent 版本扩展；8.2A 不建立第二套
规划器。

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
和高成功率收尾。`session-planner-v2` 为候选和计划活动增加 `hanzi | pinyin` 学习领域，
使用软性的拼音占比目标，同时保持到期优先、安全内容和时长约束拥有更高优先级。

`pinyin-session-planner-v1` 将拼音复习映射为到期或薄弱复习，将新声母、韵母、音节和声调
映射为新内容，将拼音到汉字练习映射为迁移活动。默认拼音占比为 `0.30`，输入限制在
`0.20–0.40`；新拼音和新汉字共同使用更严格的 0–4 新概念上限，因此不会突破原新汉字
上限。固定输入和 seed 生成可复现计划。

自适应拼音辅助有三个明确阶段：可见、点击显示、隐藏。独立识别准确率达到 `0.75` 且连续
成功至少两次时进入点击显示；准确率达到 `0.90`、连续成功至少五次且完整答案显示率低时
隐藏。连续两次错误、准确率低于 `0.55` 或完整答案显示率高于 `0.40` 时立即恢复可见辅助，
并暂时只安排拼音复习，不安排新拼音或迁移题。辅助仅附加到允许拼音脚手架的汉字活动，
不会附加到以拼音本身为学习目标的活动。

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

`humor-content-v1` 是独立的静态文本包。7.3H 发布版本 `1.0.0`，包含六条由人工逐条编辑、
审核并批准的内容；审核人是于永，审核时间是 `2026-07-23T20:55:17.680Z`。每个条目声明
`human_editorial`、`bundled`、`age_neutral_13_plus`、人工审核人和审核时间。
幽默内容级别只允许 `light | playful`；`off` 是 7.2H 的用户选择，并映射到条目中必需的
`neutralFallback`，不是一种幽默内容。

Profile 中的 `humor_preference` 默认值保持 `light`，用户可在年龄中性的“我的”或个人设置
界面改为 `off | light | playful`。选择只控制已经随应用提供且通过审核的两个静态版本，不
生成文本、不建立兴趣画像，也不请求远程服务。选择器是纯函数：`off` 无条件返回
`neutralFallback`；`light` 只允许 `light` 条目；`playful` 允许两个幽默级别。离线调用若
没有可用偏好则安全回退到中性版本，偏好更新失败时不覆盖已加载的服务端值。

幽默版和中性版分别显式保存学习目标显示文本、正确答案 ID 与正确答案文本，构建验证会比较
简繁两种脚本，确保目标和答案不变且目标仍可见。发布验证只接受 `approved | published`，
并拒绝常见羞辱、错误嘲笑、身份群体概括和中性回退中的笑声/玩笑标记。`memory_scene` 必须
标为 mnemonic，并用简繁文案说明“这是记忆联想，不是字源”；V1 幽默包拒绝 etymology claim。
这些词法规则是自动门禁而不是完整的人类安全审查；发布包已经完成人工逐条审核，任何后续
文案或答案变化都必须提高内容版本并重新审核，不能原地覆盖已发布版本。

## 8. 离线、同步与幂等

内容包可离线读取。作答先写本地持久化 outbox；恢复网络后按不可变客户端事件 UUID
批量提交。服务端以 `(user_id, offline_event_id)` 去重，按状态版本处理并发和乱序。
多设备 pull sync 使用游标，不依赖内存队列。

移动原生端使用 `expo-sqlite` 的 `hanziquest-offline.db`，Web 使用同一领域契约下的单文档
localStorage 适配器。当前本地 schema 版本为 2，表仅包含：

- `local_content_cache`
- `local_session_snapshots`
- `local_attempt_outbox`
- `local_sync_cursors`

作答完成时，attempt 与更新后的 session snapshot 在一个 SQLite 事务（Web 为一次文档写入）
中保存，成功后 UI 才标记关卡完成。`attempt_id` 是安全随机 UUID 和本地去重主键；outbox
按 `offline_sequence` 与 UUID 确定性排序。应用重启时，遗留 `in_flight` 项恢复为
`pending`，损坏 payload 被隔离而不会阻塞其他作答。

旧版 SecureStore/localStorage 演示课程状态在首次读取后迁移到 session snapshot。存储层支持
导出恢复 JSON 和清空本地缓存作为回滚/修复手段。它不缓存 profile、token、原始签名轨迹、
签名图片或原始音频，日志也不输出作答 payload。

`POST /api/attempts-batch` 接受最多 50 个同一会话的版本化作答事件。用户身份只来自 Better
Auth 会话；服务端通过 RLS 读取该用户自己的学习会话和已发布课程内容，重新校验答案，而不
信任客户端提交的 `isCorrect`。错误答案仍可作为有效学习证据保存；活动不存在、答案结构
无效或会话不属于当前用户时返回稳定机器码。

服务端以 `(user_id, offline_event_id)` 唯一约束保证重试幂等。新事件先写入不可变
`attempts`，再在同一数据库事务中按 `device_event_at`、`offline_sequence` 和事件 ID 的
稳定顺序重放相关证据，更新服务端权威的 skill state 与 review schedule。并发请求锁定同一
技能状态行并从不可变事实重算，因此一个离线事件至多改变一次状态；响应游标由最后接收的
作答时间和 ID 构成。

移动端恢复网络后按会话和本地顺序提交 outbox。`accepted`、`duplicate` 以及不可重试的
`rejected` 结果会从队列移除并保存服务器游标；网络或临时协议失败会保留事件并增加重试
计数。当前演示课程使用本地演示会话，只有由 `session-plan` 创建的真实服务器会话可完成
同步；演示事件会安全保留，等待后续学习 UI 接入真实会话规划。

### 8.1 音频选择拼音

`audio_to_pinyin` 首版在“拼音”主导航中提供可直接使用的音频辨认练习。题目音频以 MP3
随应用打包，播放和重播不请求网络，也不采集或上传语音。应用明确关闭 `expo-audio` 的录音
权限与后台录音能力；音频来源、许可、转码方式和校验和记录在资源目录中。

选项由 5.1P 的确定性拼音归一化能力生成；固定 seed 会产生相同的声调优先干扰项和稳定
答案 ID。模型把首次播放与重播次数分开记录，错误后使用支持性文案并允许重新选择。选项使用
radio 语义、可朗读的拼音与声调标签、至少 88px 的触控高度，并在窄屏切换为单列。5.2P
不产生服务端 attempt；作答持久化在后续明确的拼音会话集成任务中接入。

### 8.2 拼音选择音频

`pinyin_to_audio` 在同一主导航中显示带调拼音，提供三个匿名发音选项。所有 MP3 在模块
加载时预取并随应用打包；练习时不访问网络、不启用麦克风、不录音，也不进行发音评分。
每个音频选项可独立首次播放和重播，只有成功播放过的选项才能提交，避免把未听内容当作
有效证据。

固定 seed 只改变选项顺序，不改变正确音频 ID。音频载入和单个播放错误都有可见且可朗读
的恢复状态；重试会重新载入全部本地资源。选项不在标签中泄露读音答案，使用匿名 A/B/C
标识、明确播放与选择按钮、支持性错误反馈，并在窄屏使用单列。5.3P 同样不产生服务端
attempt，也不引入语音数据。

### 8.3 拼音选择汉字

`pinyin_to_glyph` 显示单个带调拼音和三至五个汉字选项，不依赖英语翻译。干扰项按确定性
优先级选择：同音同调字优先，其次是相同音节的其他声调，再考虑共享声母或韵母的字。固定
seed 可以改变选项顺序，但目标汉字 ID 和正确答案保持不变。

拼音本身不能区分“马”和“码”等同音同调字。只要候选集中存在这种歧义，内容就必须提供
中文语境提示并显式指定唯一目标；缺少语境的歧义题在构建阶段失败。选项为单个汉字并带有
可朗读的中文区分标签，错误反馈同时提醒检查声调和语境，不使用羞辱性文案。5.4P 不产生
服务端 attempt，也不新增数据库或翻译字段。

### 8.4 汉字选择拼音

`glyph_to_pinyin` 单独显示目标汉字和包含该字的中文词语或短句，拼音只出现在答案选项中，
不在所有汉字上方持续显示注音。内容必须显式声明目标字的已知读音和当前语境可接受读音；
答案不能由候选顺序、首个读音或客户端猜测产生。

如果目标字有多个已知读音，语境必须存在并包含目标字。未在当前语境接受的真实多音字读音
会优先成为干扰项，再选择同音节声调变体和其他读音。用户可以按需查看中文提示，答错后
提示自动显示并保留到重试；反馈不否定用户能力。固定 seed 保证选项可复现，显式接受读音
决定正确 option ID。5.5P 不产生服务端 attempt，也不新增数据库字段。

### 8.5 声调选择

`tone_choice` 从规范化拼音生成固定的一至四声和轻声五项表。例如 `ma` 的选项始终对应
`mā / má / mǎ / mà / ma`，正确 option ID 直接由目标拼音的 tone 字段决定。无调号音节
明确映射为轻声，不会被省略或当成错误数据。

题目只训练课程采用的普通话拼音声调标记，不录音、不评价用户口音或方言。每个选项同时
显示带调拼音与中文声调名称，并提供完整朗读标签；错误反馈只建议重新观察调号，不评价
学习者能力。5.6P 不产生服务端 attempt，也不新增数据库字段。

### 8.6 拼音音节拼装

`pinyin_syllable_build` 使用点按控件按“声母、韵母、声调”固定顺序完成音节，不要求拖动，
也不提供自由文本输入法。前一步未完成时后续选项不可操作；选择声母后，与其不构成合法普通话
组合的韵母会禁用，模型也会拒绝非法组合。

完成三步后，应用通过共享拼音规范化器生成正式拼写和调号位置，例如 `x + üe + 2`
规范化为 `xué`，不在 UI 中重复实现调号算法。合法但不等于目标的组合得到支持性重试，
用户也能在提交前重新开始。所有选择组使用 radio 语义、明确步骤标签和至少 48px 点按目标。
5.7P 不产生服务端 attempt，也不新增数据库字段。

### 8.7 自适应拼音显示与淡出

`pinyin-support-runtime-v1` 把用户 profile 的 `pinyin_support_mode`、会话规划器的显式信号、
当前淡出阶段和单题用户覆盖组合为不可变运行态。自适应模式从始终显示到点击显示、再到隐藏
时，每次状态协调最多前进一步；连续错误、低独立正确率或高完整答案揭示率可以立即恢复
可见拼音。`always`、`tap_to_reveal` 和 `hidden` 显式偏好始终优先。

用户可中断自适应淡出，只为当前题显示拼音；完成该题后临时覆盖自动清除，不暗中修改 profile
偏好。UI 显示状态和证据权重从同一个 presentation 结果读取：可见拼音使用
`pinyin_visible`，用户揭示使用 `pinyin_revealed`，未显示使用 `none`。因此页面不可能隐藏
拼音却降低独立证据，或显示拼音却按无提示计分。运行态不含网络、数据库、时钟或随机数。

### 8.8 规范化矢量书写画布

6.1W 只允许登录用户练习 profile 中自己的 `chinese_name`。`writing-canvas-v1` 将触控、触控笔
或鼠标位置归一化为 `[0, 1]` 范围的 `StrokePoint`，回放和 SVG 路径在当前画布尺寸下再反归一化，
因此旋转或调整窗口后不会改变已保存轨迹。高频输入按最小距离合并，每笔最多 2048 点、每份草稿
最多 256 笔，避免异常输入造成无界内存和渲染开销。

已完成笔画支持撤销、清空和按原笔序重放；减少动态效果开启时不播放逐帧动画。界面提供文字状态、
足够大的按钮和画布辅助说明。6.1W 不包含标准笔顺、描写引导、评分、签名风格或身份判断。

原始轨迹使用 `writing-draft-v2` 严格校验，只保存在设备本地：Web 使用按 Better Auth 用户 ID
隔离的 localStorage 文档，原生端使用独立 SQLite 表。损坏或键值所有者不一致的草稿不会加载，
任何 API payload、服务端表、日志或导出流程都不包含这些原始点或书写图片。

### 8.9 标准笔顺、描写与自由书写

6.2W 使用随包分发的 `hanzi-writer-data@2.0.1` 静态路径和方向中线，不在运行时访问 CDN。
首批经验证 fixture 覆盖当前测试名字“王家豪”；每个笔画路径必须与一条至少含起点和终点的
median 一一对应。数据来自 Make Me a Hanzi / Hanzi Writer Data，按 Arphic Public License
再分发，许可文本保存在 `docs/licenses/ARPHICPL.TXT`。

课程按“观察笔顺 → 描写 → 自由书写”推进。观察模式逐笔突出标准字形，用圆点表示起笔、方向线
表示行笔；描写模式在规范化画布下显示完整淡色结构；自由模式移除字形提示。切换阶段不评分、
不判断签名真伪，也不改变 6.1W 的本地原始轨迹边界。名字中没有离线资产的字不会猜测笔顺，
而是明确提示仍可自由书写。

### 8.10 确定性中文名字风格

`signature-transform-v1` 只接受显式 `own_chinese_name` scope、非空 profile 中文名字和 6.1W
规范化轨迹。清晰型保留几何，紧凑型水平收拢，前倾型按纵向位置施加确定性斜切，流畅型进行
小幅边距、纵向压缩和连续曲线偏移。所有变换保持笔画顺序、点数、时间与压力，输出严格限制在
`[0, 1]`，相同输入始终产生相同结果。

选择结果只包含 `selectedStyle`、名字和算法版本；6.3W 不保存服务器摘要，也不改变原始本地
轨迹。预览明确说明不用于身份认证、签名真伪验证或模仿真实人物。任何名人/第三方签名输入、
AI 生成、法律或法证声明均不在 V1 范围。

### 8.11 本地练习保存与自我一致性反馈

6.4W 使用 `signature-consistency-v1` 在设备本地比较用户自己的两次非空练习。算法只计算结构、
比例、主要行笔方向和笔画时长节奏四项 `[0, 1]` 派生指标；第一份练习只建立本机参考，不虚构
指标。每次完成后只保留最近一份原始参考轨迹，界面使用支持性建议，不显示真伪、身份、法律或
法证判断。

`writing-draft-v2` 在按用户隔离的 Web/SQLite 本地记录中保存当前轨迹、最近参考轨迹、所选风格、
派生反馈和持久化元数据 outbox。V1 草稿在读取时本地升级；断网或进程退出不会丢失待同步事件。
同步请求契约严格拒绝 `points`、`strokes`、图片、用户 ID、客户端练习次数和客户端汇总。

服务器只保存经会话授权的自己的中文名字项目、不可变 `signature_practice_events` 元数据事件、
练习次数和四项汇总。事件以 `(user_id, idempotency_key)` 去重并在项目行锁下串行处理；数据库
触发器从不可变事件生成权威汇总，应用角色没有直接修改汇总的权限。三个私人表均强制 RLS，
另一用户的项目、事件和汇总对当前用户不可见。停用同步即可回滚应用行为，本机轨迹与导出仍保留。

### 8.12 正式 Session Activity V2 基础

Task 8.2C-A 新增 `learning-exercise-v2`、`session-activity-v2` 和
`session-plan-snapshot-v2`，可以固定多 Lesson 活动、十种汉字/拼音题型、内容版本与 SHA-256、
拼音支持决策、静态幽默引用以及规范化 Evidence Target。题目答案只存在于登录用户已经创建且
最多 20 题的 Session 快照内；目录、Review 预览和开始前页面不得返回答案，服务端仍是最终评分
权威。

PostgreSQL `learning_session_activities` 通过 Session/user 复合外键、连续位置边界、最小 JSON
形状检查、更新拒绝触发器和强制 RLS 保存不可变 Activity。应用角色只能读取自己的快照，不能
直接插入、更新或删除。旧 V1 Session 与单 Lesson 评分链继续可读，但没有被伪装为 V2；运行时
切换、生命周期和受控 Session 创建分别属于后续任务。

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
