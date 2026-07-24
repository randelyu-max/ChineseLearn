# ADR 0005 — 一级拼音领域与规范化 Attempt Evidence

- **状态：** Accepted by supplement
- **日期：** 2026-07-24

## 背景

六种拼音题型已有移动端组件和静态内容，但正式 Exercise 合同、数据库 Skill、Attempts 评分、Mastery 和 Review 尚未支持。当前 Attempt 只保存一个主概念，其余目标放在 JSON metadata；拼音到汉字题需要同时产生不同概念类型和能力轴的 Evidence。

## 决策

1. 新增统一 `pinyin_concepts` 持久化模型，kind 为 initial/final/syllable/tone。
2. 六种拼音题型加入正式 Exercise 和 Attempts 合同。
3. 新增规范化 `attempt_evidence`，一个 Attempt 可以对应多条 Evidence。
4. Evidence 显式保存 concept、skill、ability axis、base quality、support multiplier、effective quality 和 algorithm version。
5. Skill/Review 重放以 Evidence 为来源，不再依赖 JSONB target IDs。
6. 拼音提示只影响相关汉字独立识别 Evidence，不改变答案真值，也不降低拼音目标 Evidence。
7. 词语读音支持 canonical 与 surface 形式；复杂变调不由简单运行时规则猜测。

## 被否决方案

- 把拼音继续当 UI 装饰：无法形成掌握度和复习。
- 每个拼音题只更新一个主概念：丢失迁移学习信息。
- 继续把目标数组放 JSON metadata：查询、索引、迁移和多类型 Evidence 均不可靠。
- 录音和发音评分：V1 不需要，增加隐私和模型依赖。

## 后果

- 数据库和服务端处理更规范；
- Pinyin/Tone Review Center 分组可产生真实数据；
- 需要 Evidence 回填和完整回归；
- Activity 评分映射必须版本化并接受课程审查。
