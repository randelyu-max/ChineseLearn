# HanziQuest V1 — Post-8.2A Codex 整改计划

本计划只补充 8.2A 后的执行顺序。已经完成的 Task 3.1–8.2A 保留历史记录，不重新执行，除非回归测试失败。

完成检查点：Task 8.3D 已于 2026-07-24 完成。固定的 `diagnostic-content-v1.0.0`
题包、移动端暂停/恢复/跳过/离线状态、`diagnostic-run-v1` API、强制 RLS 持久化和
Session Plan 初始先验已接通；真实 Attempts 会完全覆盖诊断先验。下一项唯一任务为
8.3E。

## 1. 被取代的旧顺序

以下顺序被取代：

```text
8.2A → 8.2B → 9.5R
```

原因：复习页面依赖正式 Session Snapshot、Review Intent、Session 生命周期和通用 Runner；这些基础目前尚未贯通。

## 2. 新的强制顺序

| 顺序 | Task                                         | 优先级 | 发布性质   |
| ---: | -------------------------------------------- | ------ | ---------- |
|    1 | 8.2C-A — 规范化 Session Activity 与 Snapshot | P0     | 核心闭环   |
|    2 | 8.2C-B — Session 生命周期与 Active Session   | P0     | 核心闭环   |
|    3 | 8.2C-C — Session Plan V2 learn/review        | P0     | 核心闭环   |
|    4 | 8.2C-D — Attempts V2 与规范化 Evidence       | P0     | 核心闭环   |
|    5 | 8.2D-A — 移动端正式 Session 数据层           | P0     | 核心闭环   |
|    6 | 8.2D-B — 通用汉字 Session Runner             | P0     | 核心闭环   |
|    7 | 5.9P-A — 拼音持久化领域                      | P0     | 核心产品   |
|    8 | 5.9P-B — 拼音服务端评分与 Evidence           | P0     | 核心产品   |
|    9 | 5.9P-C — 拼音接入 Runner                     | P0     | 核心产品   |
|   10 | 8.2A-H — Review Center 硬化                  | P1     | 稳定性     |
|   11 | 8.2B-R — 移动端复习中心                      | P0     | 核心产品   |
|   12 | 8.3D — 诊断产品化                            | P1     | V1 完整性  |
|   13 | 8.3E — 生产课程发布与导入                    | P0     | 发布阻塞   |
|   14 | 8.3C — 13+ 内容与幽默接入                    | P1     | 产品质量   |
|   15 | 6.5W — 姓名书写覆盖与签名范围硬化            | P1     | 产品承诺   |
|   16 | 8.3A — 账号删除和数据导出                    | P0     | 发布阻塞   |
|   17 | 8.3B — 真实本地化                            | P0     | 发布阻塞   |
|   18 | 8.3T — 时区与日历边界                        | P1     | 数据正确性 |
|   19 | 9.5R — 完整发布审计                          | P0     | 最终门禁   |

## 3. 阶段门槛

### Gate A — 正式汉字学习闭环

完成 8.2C-A 到 8.2D-B 后，必须通过：

```text
首页正式 learn session
→ 多 Lesson activity 可执行
→ offline attempt
→ server scoring
→ evidence/mastery/review
→ session complete
```

此时可进入内部 Alpha，但不能公开发布。

### Gate B — 拼音和复习闭环

完成 5.9P-A 到 8.2B-R 后，必须通过：

```text
拼音 session
→ tone/pinyin mastery
→ review center
→ review session
→ due count refresh
```

此时可进入受控 Beta。

### Gate C — Public V1

完成 8.3D、8.3E、8.3C、6.5W、8.3A、8.3B、8.3T 和 9.5R，且完成签名构建与真机验证后，才允许推广。

## 4. 任务纪律

- 每次只执行一个 Task 文件。
- 任何 Task 不得顺便实现下一个 Task 的 UI、数据库或 API。
- 合同版本变更必须明确兼容与废弃策略。
- 数据库只用新迁移；不修改 0001–0006。
- 未确认远程环境前不执行远程迁移、重置或清理。
- 每项任务完成后更新本计划状态，但不删除历史。
- 不自动 push。

## 5. 执行进度

- `8.2C-A`：2026-07-24 完成并通过合同、迁移、RLS、全仓回归和构建门禁。
- `8.2C-B`：2026-07-24 完成并通过 lifecycle、Active Session、幂等、并发、跨用户
  隔离、PostgreSQL 17.10 动态测试和全仓门禁。
- `8.2C-C`：2026-07-24 完成 Session Plan V2 learn/review、多来源不可变 Snapshot、
  Pinyin capability gate、空结果幂等回执和原子物化，并通过 PostgreSQL 17.10 动态测试与
  全仓门禁。
- `8.2C-D`：2026-07-24 完成基于不可变 Activity Snapshot 的 Attempts V2 服务端评分、
  多目标规范化 Evidence、历史幂等回填、稳定重放、终态拒绝和跨用户 RLS，并修正高混淆
  收尾候选造成的非确定性空计划。
- `8.2D-A`：2026-07-24 完成正式 V2 Session API client、按用户隔离的 Web/SQLite
  schema v3 缓存、引用 `sessionActivityId` 的持久 Outbox、跨重启/离线恢复、服务器终态与
  本地冲突协调、损坏 Snapshot 单独隔离和读模型失效。
- `8.2D-B`：2026-07-24 完成正式学习入口和四种汉字题型的通用 Runner；每次作答先原子
  写入 Attempt 与 Session 检查点，再进行可恢复 Outbox 同步；完成时先同步再请求服务器终态，
  并隔离开发演示路由。专项测试、真实 PostgreSQL 集成、全仓门禁和 23 路由 Expo 导出通过。
- 下一项：`5.9P-A — 拼音持久化领域模型`。

## Task 5.9P-A completion checkpoint

Task 5.9P-A completed on 2026-07-24. It added the formal `pinyin_concepts` persistence domain,
stable concept mappings, three licensed audio assets with hash/locale/attribution validation,
an idempotent approved-release import, and canonical/surface Pinyin reading contracts. Migration,
RLS, invalid-combination, unpublished-filter, and PostgreSQL 17 tests passed. Pinyin planning and
Attempts capabilities remain explicitly disabled.

## Task 5.9P-B completion checkpoint

Task 5.9P-B completed on 2026-07-24. The server now plans and authoritatively scores all six formal
Pinyin exercise types from immutable Activity Snapshots, emits normalized multi-target Evidence,
replays versioned Pinyin BKT state and Review Schedule rows, and exposes real `pinyin` and `tone`
Review Center groups. Published lesson material must use the strict `pinyin-lesson-exercise-v1`
wrapper and reference eligible published Lesson concepts.

The server capability is open, but Session Plan V2 requires the explicit
`pinyin-exercises-v1` client capability. Existing mobile clients do not send it, so they continue
to receive only the four known Hanzi types. No database migration was needed beyond the additive
Task 5.9P-A domain. The next unique task is
`5.9P-C — Pinyin integration into the universal Runner`.

## Task 5.9P-C completion checkpoint

Task 5.9P-C completed on 2026-07-24. The mobile client now opts into
`pinyin-exercises-v1`; `formal-session-runner-v2` executes the six formal Pinyin types beside the
four Hanzi types through the same persistent Attempt V2/outbox/recovery/completion path. Bundled
Pinyin audio is prefetched and cached by immutable Activity content hash, remains offline, and
fails closed with retry when an asset is not locally bound. The Pinyin tab is a formal Session
entry and active-Session progress view rather than a six-demo page.

No API contract, learning algorithm, database migration, dependency, or lockfile changed. The next
and only dependency-scoped task is `8.2A-H — Review Center pagination, ordering, and performance
hardening`.

## Task 8.2A-H completion checkpoint

Task 8.2A-H completed on 2026-07-24. Review Center now uses a signed fixed-clock keyset cursor and
a bounded PostgreSQL read model. Active Curriculum selection is explicit by spoken/script track,
and `pinyin_dependency` requires observed reduced-support Hanzi Evidence. The next unique task is
`8.2B-R — formal mobile Review Center`.

## Task 8.2B-R completion checkpoint

Task 8.2B-R completed on 2026-07-24. The mobile Review tab now consumes the read-only Review Center,
caches it per user for offline display, resumes an active formal Session, and starts new review
only through Session Plan V2 `intent: review`. Completion invalidates the cached read model after
outbox synchronization. The next unique task is `8.3D — diagnostic productization`.
