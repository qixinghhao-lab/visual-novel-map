export type Tool = "select" | "pan" | "frame" | "chapter" | "logic" | "branch" | "text";
export type InfoTab = "summary" | "main" | "branch";
export type BranchType = "short" | "medium" | "long";
export type BranchColor = "blue" | "green" | "violet";

export type LogicPointContent = {
  plot: string;
  polish: string;
  confirmed: string[];
  historyIndex: number;
};

export type ChapterNodeContent = {
  previousEnding: string;
  previousEndingPolish: string;
  nextOpening: string;
  nextOpeningPolish: string;
  confirmed: Array<{
    previousEnding: string;
    nextOpening: string;
  }>;
  historyIndex: number;
};

export type SegmentContent = {
  requirement: string;
  generated: string;
  confirmed: string[];
  historyIndex: number;
};

export type PromptCategoryId = "draft" | "polish" | "bridge" | "analysis";

export type PromptTemplate = {
  id: string;
  categoryId: PromptCategoryId;
  title: string;
  badge: string;
  version: string;
  model: string;
  binding: string;
  description: string;
  role: string;
  variables: string[];
  rules: string[];
  restrictions: string[];
  outputFormat: string;
  systemPrompt: string;
  userPrompt: string;
  defaultSystemPrompt: string;
  defaultUserPrompt: string;
  updatedAt: string;
};

export type Chapter = {
  id: string;
  name: string;
  emotion: number;
  nodeContent: ChapterNodeContent;
};

export type LogicPoint = {
  id: string;
  segmentIndex: number;
  title: string;
  emotion: number;
  nodeContent: LogicPointContent;
};

export type Branch = {
  id: string;
  name: string;
  type: BranchType;
  color: BranchColor;
  startChapter: number;
  endChapter: number;
  note: string;
};

export type TextNote = {
  id: string;
  x: number;
  y: number;
  text: string;
};

export type OutlineView = "structure" | "board" | "schedule";
export type OutlineStatus = "idea" | "draft" | "ready";

export type OutlineChapter = {
  id: string;
  title: string;
  purpose: string;
  summary: string;
  conflict: string;
  wordTarget: number;
  status: OutlineStatus;
};

export type OutlineVolume = {
  id: string;
  title: string;
  range: string;
  goal: string;
  chapters: OutlineChapter[];
};

export type OutlineState = {
  activeView: OutlineView;
  selectedChapterId: string;
  volumes: OutlineVolume[];
};

export type CharacterView = "profile" | "network" | "arc";
export type CharacterGroup = "lead" | "support" | "force";
export type CharacterRelationType = "trust" | "conflict" | "secret" | "interest";

export type StoryCharacter = {
  id: string;
  name: string;
  group: CharacterGroup;
  roleLabel: string;
  archetype: string;
  appearance: string;
  outerGoal: string;
  innerDesire: string;
  weakness: string;
  secret: string;
  relationshipSummary: string;
  arcStage: string;
  tags: string[];
};

export type CharacterRelation = {
  id: string;
  fromId: string;
  toId: string;
  type: CharacterRelationType;
  note: string;
  strength: number;
};

export type CharacterState = {
  activeView: CharacterView;
  selectedCharacterId: string;
  roster: StoryCharacter[];
  relations: CharacterRelation[];
};

export type SettingView = "profile" | "matrix" | "board";
export type SettingCategory = "rule" | "faction" | "item" | "system";
export type SettingStatus = "draft" | "active" | "locked";

export type StorySetting = {
  id: string;
  name: string;
  category: SettingCategory;
  status: SettingStatus;
  scope: string;
  coreRule: string;
  limits: string;
  impactCharacters: string;
  linkedChapters: string;
  notes: string;
  conflictRisk: number;
  aiReady: boolean;
  tags: string[];
};

export type SettingState = {
  activeView: SettingView;
  selectedSettingId: string;
  entries: StorySetting[];
};

export type WorldLayer = "terrain" | "factions" | "routes";
export type WorldEntryKind = "region" | "faction" | "rule" | "landmark";

export type WorldEntry = {
  id: string;
  name: string;
  kind: WorldEntryKind;
  layer: WorldLayer;
  latitude: number;
  longitude: number;
  summary: string;
  detail: string;
  influence: string;
  linkedChapters: string;
  linkedCharacters: string;
  risk: number;
  tags: string[];
};

export type WorldState = {
  activeLayer: WorldLayer;
  selectedEntryId: string;
  entries: WorldEntry[];
};

export type StoryState = {
  mainLineName: string;
  ending: string;
  chapters: Chapter[];
  logicPoints: LogicPoint[];
  segmentContents: Record<string, SegmentContent>;
  outline: OutlineState;
  characters: CharacterState;
  settings: SettingState;
  world: WorldState;
  prompts: PromptTemplate[];
  branches: Branch[];
  textNotes: TextNote[];
};

export type TimelinePoint = {
  id: string;
  kind: "start" | "chapter" | "logic" | "end";
  label: string;
  detail: string;
  xPercent: number;
  emotion: number;
  chapterIndex?: number;
};

export type TimelineSegmentSelection = {
  chapterSegmentIndex: number;
  fromId: string;
  toId: string;
};

export type SelectionDetailContext = {
  kind: "chapter" | "logic" | "segment";
  badge: string;
  title: string;
  subtitle: string;
  meta: Array<{
    label: string;
    value: string;
  }>;
};

export type BranchMeta = {
  label: string;
  color: BranchColor;
  range: number;
};
