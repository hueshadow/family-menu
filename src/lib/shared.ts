// Pure shared types/constants — no Node-only deps. Safe in client components.

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
    notes?: string;
  };
}

export interface DishInput {
  name: string;
  ingredients: string;
}

export interface DayInput {
  date: string;
  dishes: DishInput[];
}

export interface WeekRow {
  id: string;
  week_start: string;
  status: "draft" | "reviewing" | "locked" | "archived";
  days: DayInput[];
  locked_at: string | null;
}

export interface ShoppingItem {
  name: string;
  qty: string;
  category: string;
  checked: boolean;
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
  seasoning: "🧂 调味",
  other: "📦 其他",
};
