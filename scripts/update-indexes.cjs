const fs = require("node:fs");
const path = require("node:path");
const file = path.resolve(__dirname, "../firestore.indexes.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
for (const index of [
  {
    collectionGroup: "claims",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "requiresAdmin", order: "ASCENDING" },
      { fieldPath: "state", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "disputes",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "state", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ],
  },
])
  if (
    !data.indexes.some(
      (existing) => JSON.stringify(existing) === JSON.stringify(index),
    )
  )
    data.indexes.push(index);
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
