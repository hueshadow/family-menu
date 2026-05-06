import { describeSeasonal } from "@/lib/seasonal";
import { DISH_SLOTS, type MemberRow } from "@/lib/shared";

export interface DietaryProfileForPrompt {
  tags: string[];
  recommend: string[];
  avoid: string[];
  rationale: string | null;
}

export const SYSTEM_NUTRITIONIST = `你是一位江浙家常菜厨师 + 营养师，为一个 5 口家庭设计家常菜单。

【菜系定位】
- 江浙家常为主：清蒸、红烧（少糖少油版）、糖醋（轻甜）、白灼、炖煮、糟卤
- 可适度加入其他菜系的家常做法，如川菜（轻麻轻辣版）、徽菜、地中海风味，但仍以清爽、易消化、适合家庭同桌为前提
- 重原汁原味，避免重油重辣和刺激性过强
- 时令优先：太湖三白（白鱼/白虾/银鱼）、河鲜、莼菜、鸡头米、春笋冬笋、菱角、马兰头、香椿、塌棵菜等
- 居住地：苏州，便于采购本地食材
- 一周 6 天菜单中，可安排 1-2 天出现适度融合的其他菜系风格，其余仍以江浙家常为主
- 若使用川菜风格，只能采用轻麻、轻辣、少油版本，不得影响老人和宝宝进食
- 若使用徽菜风格，优先炖煮、蒸烧、菌菇、笋干、豆制品等家常做法，避免重油、重咸、重酱色
- 若使用地中海风味，优先鱼类、豆类、番茄、菌菇、橄榄油、香草等清爽组合，避免生冷难消化做法

【全家同桌原则】
- 每天 5 道菜（主荤 / 副荤 / 蔬菜 / 凉菜 / 汤）全员同享
- 通过烹饪法（去油、去皮、剪碎）和份量调节适配不同需求
- 不为单人单做不同菜（除非特殊医嘱）

【硬约束（必须满足）】
1. 爷爷高血压：钠盐总体偏低；推荐降压食材：芹菜、洋葱、海带、香菇、深海/河鲜、燕麦、黑木耳
2. 奶奶易消化：避免坚硬粗纤维；蒸炖、嫩肉/鱼/蛋/豆制品优先
3. 妈妈减脂：去皮去脂、烹饪用油少；杂粮替代部分白米；高蛋白足量
4. 爸爸增肌增力：每周 **至少 3 次红肉**（瘦牛肉 / 羊肉 / 瘦猪里脊 / 鸭肉），主荤或副荤位置；与减脂兼容做法（炖、煎、烤、蒸，去脂）
5. **爸爸带餐**：每天晚餐 5 道菜中 **至少 1-2 道** 适合冷藏隔夜 + 次日微波（如炖菜、卤味、红烧、糖醋、蒸菜、烩菜）；避开易出水 / 易变色的凉拌生菜与脆皮油炸（凉菜可保留，但同日另准备 1 道耐放热菜）
6. 妈妈乳糖：菜中不用奶酪 / 鲜奶；可用酸奶
7. 宝宝（18M）：菜不能太硬太辣；坚果整粒不出现；菜要可剪碎
8. 妈妈香料偏好：本周菜单中 **每天至少 1 道菜** 含香料元素（八角/桂皮/香叶/花椒/孜然/迷迭香/罗勒/陈皮等），但用量克制不冲老人宝宝
9. 周内重复：同一道菜在 6 天内最多出现 1 次
10. 每周至少 2 次鱼类（深海鱼或河鲜）

【输出语言】简体中文。食材字段格式："鲈鱼 1 条, 葱姜适量, 蒸鱼豉油"。`;

export function describeFamily(
  members: MemberRow[],
  dietary?: Map<string, DietaryProfileForPrompt>,
): string {
  return members
    .map((m) => {
      const lines: string[] = [];
      if (m.profile.healthFlags?.length)
        lines.push(`健康：${m.profile.healthFlags.join(" / ")}`);
      if (m.profile.intolerances?.length)
        lines.push(`不耐：${m.profile.intolerances.join(" / ")}`);
      if (m.profile.goals?.length)
        lines.push(`目标：${m.profile.goals.join(" / ")}`);
      if (m.profile.preferences?.length)
        lines.push(`偏好：${m.profile.preferences.join(" / ")}`);
      if (m.profile.notes) lines.push(`备注：${m.profile.notes}`);
      const dp = dietary?.get(m.id);
      if (dp) {
        if (dp.tags.length) lines.push(`处方标签：${dp.tags.join(" / ")}`);
        if (dp.recommend.length)
          lines.push(`处方推荐：${dp.recommend.join("；")}`);
        if (dp.avoid.length) lines.push(`处方忌口：${dp.avoid.join("；")}`);
        if (dp.rationale) lines.push(`处方依据：${dp.rationale}`);
      }
      return `- ${m.name}（${m.age}岁）\n  ${lines.join("\n  ")}`;
    })
    .join("\n");
}

export function buildWeekPrompt(opts: {
  members: MemberRow[];
  weekDates: string[]; // 6 ISO dates
  recentDishes: string[];
  dietary?: Map<string, DietaryProfileForPrompt>;
}): string {
  const seasonalLine = describeSeasonal(new Date(opts.weekDates[0]));
  return `【家庭成员】
${describeFamily(opts.members, opts.dietary)}

【本周日期】
${opts.weekDates.join(", ")}（周一—周六）

${seasonalLine ? `【时令优选】\n${seasonalLine}\n（请尽量使用时令食材，让本周菜单有当季风味）\n\n` : ""}【近期已做（避免重复）】
${opts.recentDishes.length ? opts.recentDishes.join("、") : "暂无历史"}

【任务】
为这 6 天每天设计 ${DISH_SLOTS.length} 道菜：${DISH_SLOTS.join(" / ")}。
严格按下列 JSON 格式输出（仅 JSON，无任何额外文字、注释或 markdown）：

{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "style": "江浙家常" | "川菜轻改" | "徽菜轻改" | "地中海轻改",
      "dishes": [
        {"slot": "主荤", "name": "...", "ingredients": "食材1 数量, 食材2 数量, ...", "reason": "为什么这道菜适合这家（一句话，可选）"},
        {"slot": "副荤", "name": "...", "ingredients": "...", "reason": "..."},
        {"slot": "蔬菜", "name": "...", "ingredients": "...", "reason": "..."},
        {"slot": "凉菜", "name": "...", "ingredients": "...", "reason": "..."},
        {"slot": "汤",   "name": "...", "ingredients": "...", "reason": "..."}
      ]
    }
    // ... 6 个 day 对象，date 严格匹配上面给的日期顺序
  ]
}

补充要求：
- 每个 day 都必须给出 style 字段，用于标记当天主风格
- 默认写 "江浙家常"
- 只有在明确融合其他菜系时，才可写 "川菜轻改"、"徽菜轻改" 或 "地中海轻改"
- 一周最多 2 天使用非 "江浙家常" style`;
}

export function buildCandidatesPrompt(opts: {
  members: MemberRow[];
  slot: string;
  currentName: string;
  todayOtherDishes: string[];
  weekOtherDishes: string[];
  dietary?: Map<string, DietaryProfileForPrompt>;
}): string {
  return `【家庭成员】
${describeFamily(opts.members, opts.dietary)}

【场景】
本周菜单中有一道 ${opts.slot}「${opts.currentName}」需要替换。

【今日其它菜】${opts.todayOtherDishes.filter(Boolean).join("、") || "（无）"}
【本周其它菜】${opts.weekOtherDishes.filter(Boolean).join("、") || "（无）"}

【任务】
给出 3 个候选替代菜（${opts.slot}），都要符合家庭硬约束，并保持江浙家常为主、可适度融合其他菜系的风格，且与今日其它菜互补、与本周其它菜不重复。
如果给出川菜候选，必须是轻麻轻辣少油版本；如果给出地中海候选，必须是熟制、清爽、易消化版本。
如果给出徽菜候选，应以炖煮、蒸烧类家常菜为主，避免口味过重。

严格按下列 JSON 格式输出（仅 JSON）：

{
  "candidates": [
    {"name": "...", "ingredients": "食材1 数量, 食材2 数量, ...", "reason": "为什么推荐（一句话）"},
    {"name": "...", "ingredients": "...", "reason": "..."},
    {"name": "...", "ingredients": "...", "reason": "..."}
  ]
}`;
}

export function buildNutritionPrompt(opts: {
  members: MemberRow[];
  days: { date: string; dishes: { name: string; ingredients: string }[] }[];
  dietary?: Map<string, DietaryProfileForPrompt>;
}): string {
  const menu = opts.days
    .map(
      (d) =>
        `${d.date}: ${d.dishes.map((x) => x.name || "（空）").join(" / ")}`,
    )
    .join("\n");

  return `【家庭成员】
${describeFamily(opts.members, opts.dietary)}

【本周菜单】
${menu}

【任务】
作为营养师，评估本周菜单：
1. 7 项核心指标（每项给等级 + 一句话）：蛋白质、钙、铁、B 族维生素、膳食纤维、钠（盐）、脂肪
2. 每位家庭成员的针对性评论（1 句）
3. 3 条具体改进建议（食材级，可执行）

严格输出 JSON：
{
  "overall": "本周整体一句话评价",
  "metrics": [
    {"name": "蛋白质", "level": "充足"|"基本满足"|"略不足"|"明显不足"|"偏高", "note": "..."},
    ...其余 6 项...
  ],
  "perMember": [
    {"name": "爷爷", "comment": "..."},
    ...5 名成员...
  ],
  "improvements": ["...", "...", "..."]
}`;
}

export function buildSubstitutePrompt(opts: {
  ingredient: string;
  dishName: string;
  members: MemberRow[];
}): string {
  return `【家庭成员】
${describeFamily(opts.members)}

【场景】今天阿姨准备做「${opts.dishName}」，但「${opts.ingredient}」缺货 / 用完了。

【任务】给出 3 个家里常备食材作为替代，要求：
- 仍能保留「${opts.dishName}」的整体风味与营养意图
- 符合家庭硬约束（爷爷低钠、奶奶易消化、爸妈减脂、妈妈乳糖不耐、宝宝软嫩）

严格输出 JSON：
{
  "substitutes": [
    {"name": "...", "howto": "替换方式或调整建议（一句话）", "tradeoff": "对比原食材的差异（一句话）"},
    {"name": "...", "howto": "...", "tradeoff": "..."},
    {"name": "...", "howto": "...", "tradeoff": "..."}
  ]
}`;
}

export function buildRecipePrompt(opts: {
  dishName: string;
  ingredients: string;
}): string {
  return `请为以下家常菜写做法。

菜名：${opts.dishName}
食材：${opts.ingredients}

要求：
- 以江浙家常清淡风格为主，可适度借鉴其他菜系；少油少盐
- 若借鉴川菜，只用轻麻轻辣少油做法；若借鉴地中海风味，优先熟制鱼类、豆类、番茄和香草组合
- 若借鉴徽菜，优先菌菇、笋干、豆制品和蒸烧炖煮做法，避免重油重咸
- 步骤简明，给阿姨看（已会做菜，无需基础说明）
- 末尾给出"老人/宝宝注意事项"一两条（如：盐量减半、鱼刺挑净、剪碎给宝宝等）
- 字数不超过 300

严格按下列 JSON 格式输出（仅 JSON）：

{
  "steps": "1. ...\\n2. ...\\n3. ...",
  "tips": "..."
}`;
}
