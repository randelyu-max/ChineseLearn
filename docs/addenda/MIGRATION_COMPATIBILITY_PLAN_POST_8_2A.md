# Post-8.2A 数据库迁移与兼容策略

## 1. 原则

1. 现有 `0001`–`0006` 视为不可变历史。
2. 新 Schema 使用下一可用编号的前向迁移。
3. 不重置远程数据库，不覆盖已发布迁移。
4. 每项迁移必须有静态验证、真实 PostgreSQL 应用、备份/恢复演练和回滚说明。
5. 在确认是否存在真实远程用户和数据前，不执行破坏性清理。

## 2. 预期迁移系列

编号以仓库实际情况为准：

```text
0007_session_activity_snapshots.sql
0008_session_lifecycle.sql
0009_session_plan_v2_materialization.sql
0010_attempts_v2_normalized_evidence.sql
0011_pinyin_persistence_domain.sql
0012_review_center_hardening.sql
0013_diagnostic_runs.sql
0014_production_curriculum_releases.sql
0015_profile_timezone.sql
0016_account_deletion_support.sql   如设计确实需要服务端 tombstone/job
```

## 3. 兼容阶段

### Phase 1 — Additive

- 新增 V2 表、列、合同和 API；
- V1 Session 继续可读；
- 新移动端只创建 V2 Session；
- 旧 Demo Session 不被升级为正式服务器 Session。

### Phase 2 — Dual Read

- Attempts 服务根据 `snapshot_schema_version` 选择旧或新解析器；
- V2 从 `learning_session_activities` 评分；
- V1 仅用于已有测试/旧 Session 过渡；
- 记录 V1 活跃 Session 数量。

### Phase 3 — V2 Only

满足以下条件后：

- 没有 V1 active Session；
- 新移动端最低版本已生效；
- 迁移回放和恢复通过；
- 可停止创建 V1 Session。

不要在同一发布中删除历史列。清理属于单独后续 ADR 和迁移。

## 4. Evidence 回填

- 从现有 Attempt 主概念和 `metadata.targetConceptIds` 生成 Evidence；
- 使用固定、记录在迁移报告中的算法版本；
- 回填脚本可重复运行且幂等；
- 比较回填前后的曝光、独立正确、提示正确、错误和 Review Due fixture；
- 不根据新算法重新解释历史答案。

## 5. 回滚

数据库 Migration 本身 forward-only。应用回滚策略：

- 保留旧 API parser 直到 V2 稳定；
- 新表不影响 V1 读取；
- 如果 V2 服务失败，停止创建新 Session，但不删除 V2 数据；
- 使用经过验证的数据库快照恢复，而不是手工 DROP；
- 回滚报告列出受影响 Session 和 Outbox 处理方式。
