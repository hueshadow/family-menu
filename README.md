# 家庭菜单 · family-menu

> 中式 5 口家庭周菜单 Web App。AI 全自动生成 6 天 × 4 菜，妈妈逐道审核，自动派生采购清单与做法详情。健康约束源自 5 份体检报告（数字版+扫描混合）。

## 角色与责任

| 角色 | 主要操作 |
|---|---|
| **妈妈** | 管理家庭档案 / 上传体检报告 / 审核每周 AI 菜单（可换菜：3 候选） |
| **奶奶** | 浏览按品类整理的采购清单，移动端勾选已购，可选导入生鲜平台 |
| **阿姨** | 查看今日菜单与做法（清淡、软嫩、老人/宝宝注意事项） |

## 家庭画像（初始）

- **爷爷**（60–65）：轻度高血压，需清淡、加降压食材
- **奶奶**（60–65）：体弱、消化弱，需高蛋白且易吸收，补 B 族 / 钙
- **爸爸**：减脂（控碳水、控油、增蛋白）
- **妈妈**：减脂；轻度乳糖不耐（酸奶可）
- **宝宝**（18 月龄 / 85cm / 24斤）：清淡软嫩；偏高大，营养充足

## 计划规则

- 周一—周六：阿姨做饭，**5 人同桌**每日 4 道菜（主荤 / 副荤 / 蔬菜 / 汤）
- 周日：自由 / 外食 / 简餐备料
- 同桌即"最大公约数"，份量与餐外补充按个体调节

## 技术栈

- Next.js 16 App Router + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase（Postgres + Storage + RLS）
- Vercel AI SDK（OpenAI 兼容协议）
- Zod 校验

## 数据流

```
PDF 上传 → 文本/视觉 OCR → AI 结构化 → 饮食处方
家庭档案 + 处方 + 历史 → AI 生成周菜单 → 妈妈审核
锁定 → 派生：菜谱做法（入 recipes 库）+ 聚合采购清单
```

## 隐私

- 体检报告 = 高敏数据；本地存放在仓库**之外**，云端走 Supabase Storage 加密
- 调 AI 前服务端剥离姓名 / 身份证 / 电话等 PII，只送指标
- `.env.local` 永不提交；任何包含 PDF / `*.pdf` / `体检报告/` 的路径已加入 `.gitignore`

## 路线图

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M1** | 脚手架、三角色路由骨架、文档冻结 | ✅ |
| **M2** | 家庭档案表单、手动菜单录入、采购清单聚合（不接 AI 也能用） | ⏳ |
| **M3** | AI 一键生成菜单 + 3 候选替换 + 做法生成入库 | ⏳ |
| **M4** | 体检 PDF 上传 + 解析 + 饮食处方 | ⏳ |
| **M5** | 营养分析 / 替代食材 / 生鲜平台对接 β | ⏳ |

## 本地启动

```bash
cp .env.example .env.local   # 填入真实凭据
npm install
npm run dev                  # http://localhost:3000
```

数据库初始化：把 `src/lib/db.sql` 粘进 Supabase SQL Editor 执行。

## 凭据安全清单

- AI Key、Supabase Secret Key、DB 密码 → 仅 `.env.local` / Vercel 环境变量
- 永不贴入 issue / commit / 聊天记录
- 暴露后立刻去服务商后台**重置**

## 目录约定

```
src/
├─ app/
│  ├─ page.tsx              角色切换首页
│  ├─ (mama)/               妈妈视图（菜单审核 / 家庭档案 / 体检报告）
│  ├─ (naina)/              奶奶视图（采购清单）
│  ├─ (ayi)/                阿姨视图（今日菜单）
│  └─ api/                  服务端（AI 代理 / Supabase 操作）
├─ lib/
│  ├─ ai.ts                 AI 客户端（OpenAI 兼容）
│  ├─ supabase.ts           Supabase 客户端（browser/server）
│  ├─ schema.ts             Zod 类型
│  └─ db.sql                Supabase schema 迁移
└─ types/
```

体检 PDF 默认路径：`~/Documents/family-menu-data/体检报告/`（环境变量 `HEALTH_REPORTS_DIR` 可改）。
