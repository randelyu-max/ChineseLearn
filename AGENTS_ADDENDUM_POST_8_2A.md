# AGENTS 补充规则 — Post-8.2A

将本文件规则合并到根 `AGENTS.md`。若与旧计划的 8.2B 或发布声明冲突，以本补充规则为准。

## 正式学习闭环

1. 正式首页、复习页和拼音页不得直接进入 Demo 或 Showcase Route。
2. 生产学习必须经过：

```text
server session plan
→ immutable session activity snapshot
→ mobile session runner
→ persistent local attempt outbox
→ server answer validation
→ normalized learning evidence
→ authoritative skill/review update
→ session completion
→ refreshed learn/review read models
```

3. `Review Center` 是只读预览，不是第二个规划器。移动端不得根据预览条目自行拼题。
4. Session 可以引用多个 Lesson、多个概念和多个学习领域；任何 Attempts 处理不得依赖单一 `learning_sessions.lesson_id`。
5. Session Activity 必须固定内容版本、来源引用、题目快照、证据目标和算法版本。
6. 固定 Session Snapshot 在 Session 创建后不可修改。发布新课程不得改变进行中 Session。
7. Session 生命周期和状态转换由服务器维护并具备幂等测试。

## 作答与证据

8. 客户端可以为了离线即时反馈读取该已开始 Session 的有限题目答案，但服务器永远重新评分；客户端 `isCorrect` 没有权威性。
9. Review Center、课程目录和未开始内容 API 不得返回答案键。
10. 一个 Attempt 可以产生多个服务端派生 Evidence 行；不要继续把多目标证据塞进 JSON 元数据并依赖 JSONB 扫描重放。
11. Evidence 必须保存 `baseQuality`、`supportMultiplier`、`effectiveQuality`、axis、concept、skill 和 algorithmVersion。
12. 拼音到汉字等迁移题可以同时更新拼音与汉字能力，但每一条 Evidence 的目标和权重必须显式、版本化、可测试。

## Demo、内容和发布声明

13. `/demo-course` 与 `*-showcase` 只允许开发和测试使用；生产导航、商店截图和正式验收不得依赖它们。
14. 生产课程必须来自版本化、已验证、已审核并可重复导入的 Curriculum Release。
15. 已发布课程不可原地修改；任何文字、答案、音频、幽默或题目变化都产生新版本和新 manifest hash。
16. 不得把 Admin Shell、占位页、静态 Demo 或仅有算法模块描述为“已完成功能”。
17. 发布清单中的 `PASS` 必须来自真实运行；未运行必须标为 `NOT RUN`。

## 用户体验边界

18. 目标用户不会读中文，因此公开 V1 至少要有真实可用的英文 UI；界面语言和学习字形偏好必须分离。
19. 复习、每日目标和周统计使用用户 IANA 时区；事件和 `due_at` 仍保存 UTC。
20. 支持应用内创建账号时，公开发布前必须提供应用内删除账号、数据导出、服务器删除和本地数据清理。
21. 中文姓名原样保存；切换简繁体不得静默修改用户姓名。
22. 不支持笔顺资源的姓名字符可以自由书写，但 UI 必须明确说明，不得猜测笔顺或声称完整支持。

## 任务纪律

23. 每次只执行一个补充任务卡。
24. 数据库使用新增、不可变、可回滚说明明确的迁移；不得修改已应用迁移或重置远程数据库。
25. 不自动 push。完成报告必须列出文件、迁移、合同版本、实际命令、真实结果、风险和回滚方式。
