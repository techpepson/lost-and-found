import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";
import { errorMessage } from "./api";

export function useDocument<T>(collectionName: string, id?: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setData(null);
    setError("");
    setLoading(!!id);
    if (!id) return;
    return onSnapshot(
      doc(db, collectionName, id),
      (snap) => {
        setData(snap.exists() ? ({ ...snap.data(), id: snap.id } as T) : null);
        setLoading(false);
      },
      (e) => {
        setError(errorMessage(e));
        setLoading(false);
      },
    );
  }, [collectionName, id, revision]);
  return { data, loading, error, retry: () => setRevision((v) => v + 1) };
}
// Constraints are memoized by the caller; every listener has a corresponding cleanup.
export function useCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  enabled = true,
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setData([]);
    setError("");
    setLoading(enabled);
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, collectionName), ...constraints),
      (snap) => {
        setData(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T));
        setLoading(false);
      },
      (e) => {
        setError(errorMessage(e));
        setLoading(false);
      },
    );
  }, [collectionName, constraints, enabled, revision]);
  return { data, loading, error, retry: () => setRevision((v) => v + 1) };
}
