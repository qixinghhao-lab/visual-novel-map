export type FeatureId =
  | "storyline"
  | "outline"
  | "characters"
  | "settings"
  | "world"
  | "library"
  | "writing"
  | "prompts"
  | "stats"
  | "trash";

export type FeatureStatus = "ready" | "planned";

export type FeatureDefinition = {
  id: FeatureId;
  label: string;
  icon: string;
  status: FeatureStatus;
  description: string;
};

export const leftNavigationFeatures: FeatureDefinition[] = [
  {
    id: "storyline",
    label: "故事线",
    icon: "⌁",
    status: "ready",
    description: "故事线工作台已打开。",
  },
  {
    id: "outline",
    label: "大纲",
    icon: "▤",
    status: "ready",
    description: "大纲工作台已打开。",
  },
  {
    id: "characters",
    label: "角色",
    icon: "♙",
    status: "ready",
    description: "角色工作台已打开。",
  },
  {
    id: "settings",
    label: "设定",
    icon: "◇",
    status: "ready",
    description: "设定工作台已打开。",
  },
  {
    id: "world",
    label: "世界观",
    icon: "◎",
    status: "ready",
    description: "世界观工作台已打开。",
  },
  {
    id: "library",
    label: "资料库",
    icon: "▱",
    status: "planned",
    description: "后续承接素材、灵感、引用资料和外部文件索引。",
  },
  {
    id: "writing",
    label: "写作",
    icon: "✎",
    status: "ready",
    description: "写作工作台已打开。",
  },
  {
    id: "prompts",
    label: "提示词",
    icon: "✦",
    status: "ready",
    description: "提示词工作台已打开。",
  },
  {
    id: "stats",
    label: "统计",
    icon: "♪",
    status: "planned",
    description: "后续承接字数、更新节奏、伏笔回收率等统计。",
  },
  {
    id: "trash",
    label: "回收站",
    icon: "⌧",
    status: "planned",
    description: "后续承接删除节点、章节和资料的恢复能力。",
  },
];
