# 家庭菜单 · family-menu

> 中式 5 口家庭周菜单 Web App。AI 全自动生成 6 天 × 5 菜，一键审核，自动派生采购清单与做法详情。健康约束源自 5 份体检报告（数字版+扫描混合）。AI 出图 + Chrome 海报合成，支持一键导出 / 微信分享。

## 家庭画像

- **爷爷**（60–65）：轻度高血压，需清淡、加降压食材
- **奶奶**（60–65）：体弱、消化弱，需高蛋白且易吸收，补 B 族 / 钙
- **爸爸**：减脂（控碳水、控油、增蛋白）
- **妈妈**：减脂；轻度乳糖不耐（酸奶可）
- **宝宝**（18 月龄 / 85cm / 24斤）：清淡软嫩；偏高大，营养充足

## 计划规则

- 周一—周六：阿姨做饭，**5 人同桌**每日 5 道菜（主荤 / 副荤 / 蔬菜 / 凉菜 / 汤）
- 周日：自由 / 外食 / 简餐备料
- 同桌即"最大公约数"，份量与餐外补充按个体调节

## 技术栈

- Next.js 16 App Router + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase（Postgres + Storage）
- Vercel AI SDK（OpenAI 兼容协议）
- Zod 校验

## 数据流

```
PDF 上传 → 文本/视觉 OCR → AI 结构化 → 饮食处方
家庭档案 + 处方 + 历史 → AI 生成周菜单 → 审核 / 换菜
锁定 → 派生：菜谱做法（入 recipes 库）+ 聚合采购清单
AI 出图（菜品图 + 餐桌图）→ Chrome 合成海报 → 下载 / 分享
```

## 页面路由

所有页面走统一入口，无旧版三角色路由（`/mama` `/naina` `/ayi` 已删除）。

| 路由 | 功能 |
|---|---|
| `/` | 主页：智能当日卡片（13:00 前显示今日，之后显示明日）+ 本周菜单缩略 |
| `/menu` | 本周菜单编辑器：AI 一键生成、逐道换菜（3 候选）、出图、海报 |
| `/today` | 今日菜单 + 每道菜做法详情 + 替代食材 |
| `/shopping` | 本周聚合采购清单（按品类）|
| `/shopping/[date]` | 指定日期单日采购清单 |
| `/family` | 家庭成员档案 |
| `/trend` | 营养趋势图表 |
| `/history` | 历史菜单浏览 |
| `/reports` | 体检报告上传与 AI 解析 |

## 图片流水线

### AI 出图（在线触发）

菜单审核锁定后，在 `/menu` 页可一键触发：

1. **菜品图**（`src/lib/dish-photos.ts`）：每道菜生成 1024×1024 食品摄影图，并发批次 5，保存到 `~/Documents/family-menu-data/dish-images/d{N}-s{M}.png`
2. **餐桌图**（`src/lib/table-photo.ts`）：每天生成 1536×1024 俯拍摆盘图，并发批次 3，保存到 `~/Documents/family-menu-data/table-photos/{date}.png`

图片模型由 `AI_MODEL_IMAGE` 环境变量指定（默认 `gpt-image-2`）。

### 海报合成（依赖 Google Chrome）

3. **周菜单海报**（`src/lib/menu-board.ts`）：将 30 道菜品图拼成 1024px 宽 HTML 网格，调用 headless Chrome 截图，输出 `~/Documents/family-menu-data/menu-boards/{weekStart}_week_real.png`，通过 `GET /api/photo/menu-board/[weekStart]` 提供访问
4. **当日卡片**（`src/lib/day-board.ts`）：餐桌图 + 菜品图合成日卡，输出 `~/Documents/family-menu-data/day-boards/{date}.png`，通过 `GET /api/photo/day-board/[date]` 提供访问

### 一键导出（前端）

**`DownloadCardImageButton`**：点击后将页面卡片 HTML 序列化，`POST /api/photo/card`，服务端用 headless Chrome 截图并推到 `~/Downloads/{filename}.png`，同时触发浏览器下载。

### API 路由汇总

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/photo/dish/[dayIdx]/[slotIdx]` | GET | 提供菜品图（本地文件） |
| `/api/photo/table/[date]` | GET | 提供餐桌图 |
| `/api/photo/menu-board/[weekStart]` | GET | 提供周菜单海报 |
| `/api/photo/day-board/[date]` | GET | 提供当日卡片 |
| `/api/photo/card` | POST | 渲染任意 HTML 卡片为 PNG 并下载 |

### 独立脚本（手动运行）

```bash
# 批量生成本周菜品图（默认 gpt-image-2，可传模型名覆盖）
node --env-file=.env.local scripts/gen-dish-photos.mjs [model]

# 批量生成本周餐桌图
node --env-file=.env.local scripts/gen-table-photos.mjs [model] [weekStart]

# 将菜品图合成周菜单海报 PNG（需已有菜品图）
node --env-file=.env.local scripts/compose-menu-board.mjs
```

> 独立脚本需要直连 Postgres，需在 `.env.local` 配置 `SUPABASE_DB_HOST` / `SUPABASE_DB_USER` / `SUPABASE_DB_PASSWORD`（见 `.env.example`）。

## 本地数据目录

应用运行时自动创建，无需手动建立：

```
~/Documents/family-menu-data/
├─ dish-images/          菜品图  d{N}-s{M}.png
├─ table-photos/         餐桌图  {date}.png
├─ menu-boards/          周海报  {weekStart}_week_real.png
├─ day-boards/           日卡    {date}.png
└─ 体检报告/             PDF 源文件（环境变量 HEALTH_REPORTS_DIR 可覆盖）
```

## 部署形态

生产访问地址：**https://familymenu.xyz**（cloudflared 具名隧道）

### 依赖项

| 依赖 | 用途 |
|---|---|
| **Google Chrome**（`/Applications/Google Chrome.app/`）| headless 海报渲染；必须安装在 macOS 默认路径 |
| **cloudflared**（已登录 + `~/.cloudflared/config.yml`）| 公网隧道 → familymenu.xyz |
| `AI_MODEL_IMAGE` 环境变量 | AI 出图模型名（默认 `gpt-image-2`） |

### Mac 重启自动恢复

两个独立 launchd agent，分别管理应用进程与隧道进程：

```bash
# 安装并启动 Next.js 应用（构建 + 后台常驻）
bash scripts/launchd/install.sh

# 安装并启动 cloudflared 隧道（需先完成 cloudflared tunnel login）
bash scripts/launchd/install-tunnel.sh

# 状态
bash scripts/launchd/status.sh

# 日志
tail -F ~/Library/Logs/family-menu.{out,err}.log
tail -F ~/Library/Logs/family-menu-tunnel.{out,err}.log

# 验证隧道
curl https://familymenu.xyz/api/health

# 卸载
bash scripts/launchd/uninstall.sh
```

崩溃后 launchd 会自动重启。

## 本地开发

```bash
cp .env.example .env.local   # 填入真实凭据
npm install
npm run migrate              # 一次性，初始化 Supabase schema
npm run seed                 # 一次性，写入 5 名家庭成员
npm run dev                  # 本机访问 http://localhost:3000
```

### 局域网访问（手机）

```bash
npm run ip          # 打印 Mac 的局域网 IP
npm run dev:lan     # 监听 0.0.0.0:3000，手机浏览器访问 http://<你的IP>:3000
```

### 生产构建

```bash
npm run build
npm run start:lan
```

## 自动调度

每周日 09:00—09:59，内置调度器（`src/lib/scheduler.ts`）检测到触发窗口后，自动调用 `src/lib/auto-gen.ts` 生成下周菜单，结果写入 DB。调度器在 `instrumentation.ts` 启动钩子中初始化，随 Next.js 进程存活。

## 批量解析体检报告

```bash
npm run batch:reports
```

处理 `~/Documents/family-menu-data/体检报告/` 中的全部 PDF（`HEALTH_REPORTS_DIR` 可覆盖）。文件名含「爷爷/奶奶/妈妈/爸爸/陆喆霆/宝宝」自动认人；数字版走 `pdftotext`，扫描件走 `pdftoppm` + 视觉模型 OCR；每位成员合成饮食处方写入 `dietary_profiles`。

## 隐私

- 体检报告 = 高敏数据；本地存放在仓库**之外**，云端走 Supabase Storage 加密
- 调 AI 前服务端剥离姓名 / 身份证 / 电话等 PII，只送指标
- `.env.local` 永不提交；PDF 路径已加入 `.gitignore`

## 凭据安全清单

- AI Key、Supabase Secret Key、DB 密码 → 仅 `.env.local`
- 永不贴入 issue / commit / 聊天记录

## 目录结构

```
src/
├─ app/
│  ├─ (app)/                  统一应用布局（无角色路由）
│  │  ├─ page.tsx             主页：智能当日卡片 + 本周菜单
│  │  ├─ menu/page.tsx        菜单编辑器：AI 生成 + 出图 + 海报
│  │  ├─ today/page.tsx       今日菜单 + 做法 + 替代食材
│  │  ├─ shopping/page.tsx    本周采购清单
│  │  ├─ shopping/[date]/     单日采购清单
│  │  ├─ family/page.tsx      家庭档案
│  │  ├─ trend/page.tsx       营养趋势
│  │  ├─ history/page.tsx     历史菜单
│  │  └─ reports/page.tsx     体检报告
│  ├─ api/
│  │  ├─ health/              健康探针
│  │  └─ photo/               图片服务（dish / table / menu-board / day-board / card）
│  └─ actions.ts              Server Actions
├─ components/
│  ├─ ui/                     shadcn 组件
│  ├─ menu-editor.tsx         菜单网格 + AI 生成 + 出图触发
│  ├─ download-card-image-button.tsx  卡片 → PNG 一键下载
│  ├─ download-image-button.tsx       图片下载辅助
│  ├─ shopping-list.tsx       按品类勾选 + 平台搜索链
│  ├─ recipe-block.tsx        做法懒加载
│  ├─ substitute-helper.tsx   替代食材弹窗
│  └─ report-row.tsx          体检报告处理行
└─ lib/
   ├─ ai-server.ts            AI HTTP 客户端（OpenAI 兼容）
   ├─ db.ts                   Postgres 连接池 + 数据访问
   ├─ db.sql                  Supabase 迁移脚本
   ├─ shared.ts               类型 / 常量（客户端可用）
   ├─ schema.ts               Zod 验证
   ├─ prompts.ts              AI 提示词集合
   ├─ menu-gen.ts             菜单 / 候选 / 做法 / 营养 / 替代生成
   ├─ dish-photos.ts          菜品 AI 出图（API 触发）
   ├─ table-photo.ts          餐桌 AI 出图（API 触发）
   ├─ menu-board.ts           周菜单海报合成（headless Chrome）
   ├─ day-board.ts            当日卡片合成（headless Chrome）
   ├─ health.ts               体检报告解析 + 处方推导
   ├─ pdf.ts                  PDF 文本/视觉路径
   ├─ seasonal.ts             苏州 12 月时令食材
   ├─ scheduler.ts            周日 09:00 自动调度
   ├─ auto-gen.ts             自动生成下周菜单
   └─ supabase.ts             Supabase 客户端
instrumentation.ts            Next.js 启动钩子（启 scheduler）

scripts/
├─ migrate.mjs                schema 迁移
├─ seed.mjs                   5 名家庭成员 seed
├─ batch-process-reports.mjs  批量解析体检报告
├─ gen-dish-photos.mjs        独立批量出菜品图
├─ gen-table-photos.mjs       独立批量出餐桌图
├─ compose-menu-board.mjs     独立合成周海报（需有菜品图）
├─ reagg-shopping-list.mjs    重新聚合采购清单
├─ smoke-*.mjs                端到端冒烟测试
└─ launchd/                   macOS 自启服务（app + tunnel 两个 agent）
```

## 路线图

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M1** | 脚手架、App Router 骨架、文档冻结 | ✅ |
| **M2** | 家庭档案、手动菜单录入、采购清单聚合 | ✅ |
| **M3** | AI 一键生成菜单 + 3 候选替换 + 做法生成入库 | ✅ |
| **M4** | 体检 PDF 解析（数字 / 扫描）+ 饮食处方 | ✅ |
| **M5** | 营养分析 + 历史 + 替代食材 + 平台搜索链 | ✅ |
| **M6** | 图片流水线：菜品图 / 餐桌图 / 周海报 / 日卡 | ✅ |
| **M7** | 一键卡片导出（Chrome 截图）+ 微信分享 | ✅ |
| **M8** | 统一入口重构（去除角色路由）+ 智能当日卡片 | ✅ |
| **M9** | cloudflared 具名隧道（familymenu.xyz）+ launchd 双 agent | ✅ |
| **+** | 时令食材 + 营养趋势 + 周日自动调度 | ✅ |
| **+** | 温暖餐桌主题 | ✅ |
