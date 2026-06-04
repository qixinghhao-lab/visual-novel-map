import type {
  BranchMeta,
  BranchType,
  CharacterState,
  ChapterNodeContent,
  LogicPointContent,
  OutlineState,
  SegmentContent,
  SettingState,
  StoryState,
  WorldState,
} from "../types/story";
import { createPromptTemplates } from "./promptTemplates";

export function createLogicPointContent(): LogicPointContent {
  return {
    plot: "",
    polish: "",
    confirmed: [],
    historyIndex: -1,
  };
}

export function createChapterNodeContent(): ChapterNodeContent {
  return {
    previousEnding: "",
    previousEndingPolish: "",
    nextOpening: "",
    nextOpeningPolish: "",
    confirmed: [],
    historyIndex: -1,
  };
}

export function createSegmentContent(): SegmentContent {
  return {
    requirement: "",
    generated: "",
    confirmed: [],
    historyIndex: -1,
  };
}

export function createOutlineState(): OutlineState {
  return {
    activeView: "structure",
    selectedChapterId: "",
    volumes: [],
  };
}

export function createCharacterState(): CharacterState {
  return {
    activeView: "profile",
    selectedCharacterId: "",
    roster: [],
    relations: [],
  };
}

export function createSettingState(): SettingState {
  return {
    activeView: "profile",
    selectedSettingId: "",
    entries: [],
  };
}

export function createWorldState(): WorldState {
  return {
    activeLayer: "terrain",
    selectedEntryId: "",
    entries: [],
  };
}

export const emptyStory: StoryState = {
  mainLineName: "未命名主线",
  ending: "",
  chapters: [],
  logicPoints: [],
  segmentContents: {},
  outline: createOutlineState(),
  characters: createCharacterState(),
  settings: createSettingState(),
  world: createWorldState(),
  prompts: createPromptTemplates(),
  branches: [],
  textNotes: [],
};

export const branchMeta: Record<BranchType, BranchMeta> = {
  short: { label: "短线", color: "blue", range: 2 },
  medium: { label: "中线", color: "green", range: 8 },
  long: { label: "长线", color: "violet", range: 30 },
};

export const emotionLayers = [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5] as const;
