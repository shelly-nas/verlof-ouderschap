import { useSearchParams } from "react-router-dom";
import { addMonthsOnly, monthKey } from "./dates";

const MONTH = /^\d{4}-\d{2}$/;

/**
 * De maand uit ?maand=jjjj-mm, met navigatie. Zonder parameter geldt
 * `fallback` (meestal de huidige maand volgens de server).
 */
export function useMonthParam(fallback: string | null) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("maand");
  const month = raw && MONTH.test(raw) ? raw : fallback;

  function go(target: string | null) {
    setParams(target ? { maand: target } : {}, { replace: false });
  }

  return {
    month,
    requested: raw && MONTH.test(raw) ? raw : null,
    previous: () => month && go(monthKey(addMonthsOnly(`${month}-01`, -1))),
    next: () => month && go(monthKey(addMonthsOnly(`${month}-01`, 1))),
    current: () => go(null),
  };
}
