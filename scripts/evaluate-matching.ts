import { scoreMatch } from "../shared/domain.ts";
import type { Report } from "../shared/domain.ts";
const baseline = {
  id: "lost",
  authorId: "owner",
  title: "Blue campus backpack",
  description: "Blue canvas backpack with two straps",
  type: "lost",
  state: "open",
  category: "Bag",
  color: "blue",
  brand: "Campus",
  location: "Balme Library",
  locationDetail: "",
  eventDate: "2026-09-10",
  approximateDate: false,
  photoPath: "",
  createdAt: 1,
  updatedAt: 1,
  activeClaimId: null,
  requiresAdmin: false,
  schemaVersion: 2,
} as Report;
const pairs = [
  { label: true, change: { title: "Blue backpack", eventDate: "2026-09-11" } },
  {
    label: true,
    change: {
      brand: "",
      color: "",
      description: "A canvas backpack",
      approximateDate: true,
    },
  },
  {
    label: false,
    change: {
      category: "Keys",
      title: "Keys",
      description: "A ring of keys",
      brand: "",
      color: "",
    },
  },
  {
    label: false,
    change: {
      color: "red",
      brand: "Other",
      location: "Great Hall",
      eventDate: "2026-08-01",
    },
  },
  {
    label: false,
    change: {
      color: "green",
      brand: "Different",
      location: "Night Market",
      eventDate: "2026-09-11",
      description: "A leather bag with a large handle",
      title: "Green leather bag",
    },
  },
] as const;
let tp = 0,
  fp = 0,
  fn = 0,
  tn = 0;
for (const [i, pair] of pairs.entries()) {
  const result = scoreMatch(baseline, {
    ...baseline,
    id: "found-" + i,
    authorId: "finder",
    type: "found",
    ...pair.change,
  } as Report);
  const predicted = result.score >= 60;
  if (predicted && pair.label) tp++;
  else if (predicted) fp++;
  else if (pair.label) fn++;
  else tn++;
}
console.log(
  JSON.stringify(
    {
      algorithm: "rules-v1",
      threshold: 60,
      dataset:
        "Five synthetic smoke-test pairs; not an independent research evaluation",
      tp,
      fp,
      fn,
      tn,
      precision: tp / (tp + fp) || 0,
      recall: tp / (tp + fn) || 0,
      limitation:
        "Collect and label campus examples; tune on a development split and evaluate on a held-out split before making effectiveness claims.",
    },
    null,
    2,
  ),
);
