export type ItemStatus = "lost" | "found";

export type ItemCategory =
  "Phone" | "Wallet" | "ID Card" | "Bag" | "Keys" | "Others";

export interface Item {
  id: string;
  title: string;
  description: string;
  status: ItemStatus;
  category: ItemCategory;
  location: string;
  date: string;
  imageUrl?: string;
  authorId: string;
  authorEmail?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SavedItem {
  id: string;
  userId: string;
  itemId: string;
  savedAt: Date;
}
