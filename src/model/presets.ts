import type { StudioEdgeData, StudioNodeData } from "./types";

export const cardinalityPresets: {
  label: string;
  description: string;
  patch: Partial<StudioEdgeData>;
}[] = [
  {
    label: "(0,1)",
    description: "Optional, at most one",
    patch: { minimum: "0", maximum: "1", participation: "partial" },
  },
  {
    label: "(1,1)",
    description: "Exactly one",
    patch: { minimum: "1", maximum: "1", participation: "total" },
  },
  {
    label: "(0,N)",
    description: "Optional, many",
    patch: { minimum: "0", maximum: "N", participation: "partial" },
  },
  {
    label: "(1,N)",
    description: "At least one, many",
    patch: { minimum: "1", maximum: "N", participation: "total" },
  },
];

export const specializationPresets: {
  label: string;
  description: string;
  patch: Partial<StudioNodeData>;
}[] = [
  {
    label: "d · partial",
    description: "At most one subclass; membership is optional",
    patch: { constraint: "disjoint", completeness: "partial" },
  },
  {
    label: "d · total",
    description: "Exactly one subclass",
    patch: { constraint: "disjoint", completeness: "total" },
  },
  {
    label: "o · partial",
    description: "Any number of subclasses, including none",
    patch: { constraint: "overlap", completeness: "partial" },
  },
  {
    label: "o · total",
    description: "At least one subclass; multiple are allowed",
    patch: { constraint: "overlap", completeness: "total" },
  },
];
