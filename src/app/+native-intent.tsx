import { appPath } from "../../shared/navigation";
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  return appPath(path);
}
