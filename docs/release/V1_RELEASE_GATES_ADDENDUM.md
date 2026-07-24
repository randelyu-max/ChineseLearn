# V1 发布门槛补充

本文件补充 `V1_RELEASE_CHECKLIST.md`。8.2A 完成只表示只读复习 API 通过，不表示 V1 功能完整。

## P0 Blockers

- [ ] 首页不再进入 Demo；
- [x] Session Activity Snapshot V2（8.2C-A，2026-07-24）；
- [x] Session 生命周期（8.2C-B，2026-07-24）；
- [x] Session Plan V2 learn/review 与原子 Snapshot 物化（8.2C-C，2026-07-24）；
- [x] 多 Lesson Attempts V2 与规范化 Evidence（8.2C-D，2026-07-24）；
- [ ] 正式汉字 Runner；
- [x] 拼音持久化、评分、掌握度和复习（5.9P-A/B/C，2026-07-24）；
- [x] 正式 Review Session 和移动端复习页（8.2B-R，2026-07-24）；
- [ ] 生产 Curriculum Release 可在空数据库导入；
- [ ] App 内账号删除和 Server/Local 清理；
- [ ] 数据导出；
- [ ] `en-US` 与 `zh-CN` 真实 UI，或商店/选择器与更小范围严格一致；
- [ ] 无生产占位页、Demo/Showcase 入口；
- [ ] signed native builds；
- [ ] physical-device test；
- [ ] privacy/store/delete resources。

## P1 Quality Gates

- [x] 诊断结果影响起点（8.3D，2026-07-24）；
- [ ] 用户时区；
- [ ] 13+ 内容；
- [ ] 幽默接入正式 Session；
- [ ] 姓名书写覆盖报告；
- [x] Keyset Review pagination（8.2A-H，2026-07-24）；
- [ ] VoiceOver/TalkBack；
- [ ] audio/editorial review。

## 禁止的 PASS

以下情况不能标 PASS：

- 只运行了 Web Export，却写“iOS/Android 已验证”；
- 只有 Fixture，却写“生产课程已发布”；
- 只有组件 Showcase，却写“拼音功能完成”；
- 只有算法单元测试，却写“诊断功能完成”；
- 只有 Review API，却写“复习功能完成”；
- Support 邮箱是唯一删除方式；
- UI 语言选择存在但界面未翻译；
- 只有三个字的笔顺，却写“支持中文姓名笔顺”。
