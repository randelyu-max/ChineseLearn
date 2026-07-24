# ADR 0004 — 生产 Session Activity Snapshot 与正式学习闭环

- **状态：** Accepted by supplement
- **日期：** 2026-07-24
- **范围：** Session Plan、Attempts、离线、移动端 Runner、Review

## 背景

现有 Session Plan 只返回抽象候选并保存一个 `lesson_id`，而 Attempts Batch 只从该 Lesson 的 `content_spec` 找题。计划可能来自多个 Lesson 或拼音静态内容，导致移动端无法获得完整题目、服务端也可能返回 `ACTIVITY_NOT_FOUND`。正式首页仍使用固定 Demo。

## 决策

1. 每个正式 Session 保存有序、不可变的 Session Activity Snapshot。
2. 每个 Activity 固定来源、内容版本、hash、完整练习、Evidence Targets、拼音辅助和幽默版本。
3. Session 可以包含多个 Lesson 和领域，不再依赖单一 `lesson_id` 评分。
4. 移动端缓存一个有限 Session 的题目和答案以支持离线即时反馈；服务端仍重新评分，客户端正确性不可信。
5. Review Center 继续是只读预览；正式复习通过 `session-plan-v2 intent=review`。
6. 增加服务器权威 Session 生命周期和 Active Session 恢复。
7. Demo/Showcase 退出生产导航。

## 被否决方案

### 继续让移动端根据 Review Center 拼题

否决：产生第二套规划器、绕过先修和难度保护、无法保证跨设备一致。

### Session 只保存一个 Lesson

否决：不能支持跨 Lesson 复习、拼音迁移和混合 Session。

### 只返回 contentRef，不保存快照

否决：课程升级会改变进行中 Session，离线和服务端重放不稳定。

### 完全隐藏答案键

否决作为 V1 默认：已下载 Session 需要离线即时反馈。HanziQuest 不是高风险考试；服务器重评和有限 Session 边界足以保护学习状态。Review/目录 API 仍不泄露答案。

## 后果

正面：

- 正式学习闭环可实现；
- 多 Lesson、拼音和 Review 使用同一框架；
- 离线和跨设备恢复稳定；
- 课程发布不破坏进行中 Session。

代价：

- 新增 Activity Snapshot 表和合同版本；
- 需要 Attempts V2；
- 移动端本地 Schema 升级；
- Session Snapshot 体积增加，需要大小上限和压缩/缓存策略。

## 不变量

- Session Snapshot 插入后不可变；
- 用户不能访问其他用户 Session；
- 客户端不能写 mastery/review；
- 服务器评分使用 Session 固定内容；
- 固定输入和 seed 生成相同 Activity 顺序；
- 已完成/放弃 Session 不接受新 Attempt。
