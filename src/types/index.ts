export type Role = "mama" | "naina" | "ayi";

export const ROLE_LABELS: Record<Role, string> = {
  mama: "妈妈",
  naina: "奶奶",
  ayi: "阿姨",
};

export const ROLE_DESC: Record<Role, string> = {
  mama: "审核每周菜单 · 管理家庭档案",
  naina: "采购清单勾选 · 一键导入平台",
  ayi: "查看今日菜单 · 做法详情",
};
