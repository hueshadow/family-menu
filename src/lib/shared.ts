// Pure shared types/constants — no Node-only deps. Safe in client components.

export const DISH_SLOTS = ["主荤", "副荤", "蔬菜", "凉菜", "汤"] as const;
export const DISH_ICONS = ["🍖", "🍳", "🥬", "🥗", "🍲"] as const;
export const DISHES_PER_DAY = DISH_SLOTS.length;
export const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六"] as const;

export type MemberRole = "yeye" | "nainai" | "baba" | "mama" | "baby";

export interface MemberRow {
  id: string;
  name: string;
  role: MemberRole;
  age: number;
  profile: {
    healthFlags?: string[];
    allergies?: string[];
    intolerances?: string[];
    goals?: string[];
    preferences?: string[];
    notes?: string;
  };
}

export interface DishInput {
  name: string;
  ingredients: string;
}

export interface DayInput {
  date: string;
  style?: string;
  dishes: DishInput[];
}

export interface WeekRow {
  id: string;
  week_start: string;
  status: "draft" | "reviewing" | "locked" | "archived";
  days: DayInput[];
  locked_at: string | null;
  auto_generated?: boolean;
}

export interface ShoppingItem {
  name: string;
  qty: string;
  category: string;
  checked: boolean;
  /**
   * 'buy'    : 必须采购（鱼菜肉果等）
   * 'pantry' : 调味品 / 家中常备 — 只需确认是否够用，不算购物
   */
  kind?: "buy" | "pantry";
}

export interface ShoppingListRow {
  id: string;
  week_id: string;
  items: ShoppingItem[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  protein: "🐟 蛋白类",
  vegetable: "🥬 蔬菜",
  dairy: "🥛 奶制品",
  fruit: "🍎 水果",
  grain: "🌾 主食",
  seasoning: "🧂 调味品 · 确认家中库存",
  other: "📦 其他",
};
