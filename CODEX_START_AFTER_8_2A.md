# 给 Codex 的起始指令：Task 8.2A 完成后

请先读取并遵守：

- `AGENTS.md`
- `AGENTS_ADDENDUM_POST_8_2A.md`
- `docs/PRODUCT_TECH_DESIGN.md`
- `docs/addenda/PRODUCT_TECH_DESIGN_ADDENDUM_POST_8_2A.md`
- `docs/CODEX_IMPLEMENTATION_PLAN.md`
- `docs/addenda/CODEX_REMEDIATION_PLAN_POST_8_2A.md`
- `docs/ADR/0004-production-session-snapshot-and-learning-loop.md`
- `docs/ADR/0005-first-class-pinyin-and-normalized-evidence.md`
- `docs/ADR/0006-public-v1-release-boundaries.md`
- `docs/audits/HanziQuest_V1_AUDIT_2026-07-24.md`
- `docs/release/V1_RELEASE_GATES_ADDENDUM.md`
- `TASK_MANIFEST_POST_8_2A.yaml`

## 当前正式状态

1. Task 8.2A 已完成并作为只读复习中心 API 基线保留。
2. 原 Task 8.2B 的直接执行顺序被本补充设计取代。
3. 不允许先做一个只展示复习列表的页面，然后宣称 V1 可以发布。
4. 下一项唯一允许执行的代码任务是：

```text
Task 8.2C-A — 规范化 Session Activity 与不可变 Snapshot 合同
```

## 开始前必须做的检查

进入 Plan mode，并记录：

- `git status --short`
- `git diff --stat`
- 当前分支和 HEAD
- 最近 5 个 commit
- Task 8.2A 的最终完成报告和真实验证结果
- `docs/release/V1_RELEASE_CHECKLIST.md` 中仍未完成或错误标记的项目

如果工作树不干净：

- 不使用 `git reset --hard`
- 不使用 `git clean`
- 不丢弃 Task 8.2A 改动
- 先列出改动来源、文件和风险

## 文档基线合并

在不删除历史设计的前提下：

1. 将 `AGENTS_ADDENDUM_POST_8_2A.md` 中的规则合并到根 `AGENTS.md`。
2. 在 `docs/PRODUCT_TECH_DESIGN.md` 顶部增加指向补充设计的“Post-8.2A 补充基线”说明。
3. 在 `docs/CODEX_IMPLEMENTATION_PLAN.md` 中把原 `8.2B → 9.5R` 顺序标记为 **SUPERSEDED**，并链接新整改计划。
4. 在 `docs/release/V1_RELEASE_CHECKLIST.md` 中注明：8.2A 完成不代表核心学习闭环或公开发布完成。
5. 不重写已经完成的 Task 3.1–8.2A 历史记录。

## 本次唯一实现任务

只执行：

`docs/tasks/post-8.2A/08.2C-A-canonical-session-activity-snapshot.md`

不要同时执行：

- Session 生命周期
- 移动端 Runner
- 拼音数据库迁移
- 复习页面
- 账号删除
- i18n
- 课程内容扩充
- 发布审计

## 全局禁止

- 不引入生成式 AI、AI SDK、Prompt、AI entitlement 或未来 AI 空接口。
- 不重新引入 Parent、Child Profile、Household、Guardian 或角色切换。
- 不把 Demo/Showcase 当成正式学习路径。
- 不允许客户端写 mastery、review schedule 或权威 Session 状态。
- 不自动 commit 或 push；完成后等待人工确认。

完成 8.2C-A 后必须停止，并按任务卡中的报告格式输出真实结果。
