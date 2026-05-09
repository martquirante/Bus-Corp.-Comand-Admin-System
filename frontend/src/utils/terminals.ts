import type { MainRouteLineId } from "@/utils/routeLines";

export type TerminalId = "fvr" | "muzon" | "st-cruz" | "gma" | "pitx";

export type TerminalDefinition = {
  id: TerminalId;
  name: string;
  label: string;
  plusCode: string;
  address: string;
  position: [number, number];
  lineIds: Exclude<MainRouteLineId, "hidden">[];
};

export const TERMINAL_ICON_ASSET = "/assets/Terminal/3D_terminal.png";

export const MAIN_TERMINALS: TerminalDefinition[] = [
  {
    id: "fvr",
    name: "FVR Terminal",
    label: "FVR",
    plusCode: "V25X+F8",
    address: "Norzagaray, Bulacan",
    position: [14.8586875, 121.0483125],
    lineIds: ["fvr-pitx", "fvr-stcruz"]
  },
  {
    id: "muzon",
    name: "Muzon Terminal",
    label: "MUZON",
    plusCode: "R22M+XV",
    address: "San Jose del Monte, Bulacan",
    position: [14.8024375, 121.0346875],
    lineIds: ["fvr-stcruz"]
  },
  {
    id: "st-cruz",
    name: "ST. CRUZ Terminal",
    label: "ST. CRUZ",
    plusCode: "JX3J+XP",
    address: "Manila, Metro Manila",
    position: [14.6049375, 120.9818125],
    lineIds: ["fvr-stcruz"]
  },
  {
    id: "gma",
    name: "GMA Terminal",
    label: "GMA",
    plusCode: "J2MV+W8",
    address: "Quezon City, Metro Manila",
    position: [14.6348125, 121.0433125],
    lineIds: ["fvr-pitx"]
  },
  {
    id: "pitx",
    name: "PITX Terminal",
    label: "PITX",
    plusCode: "GX6R+2G",
    address: "Paranaque, Metro Manila",
    position: [14.5100625, 120.9913125],
    lineIds: ["fvr-pitx"]
  }
];

export const TERMINAL_BOUNDS = MAIN_TERMINALS.map((terminal) => terminal.position);
