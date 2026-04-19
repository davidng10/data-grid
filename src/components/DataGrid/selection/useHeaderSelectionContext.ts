import { useContext } from "react";

import { HeaderSelectionContext } from "./HeaderSelectionContext";
import type { HeaderSelectionContextValue } from "./HeaderSelectionContext";

export function useHeaderSelectionContext(): HeaderSelectionContextValue | null {
  return useContext(HeaderSelectionContext);
}
