import { useCallback, useLayoutEffect, useRef } from "react";

// The `any`s here are load-bearing: the internal wrapper must forward an
// arbitrary argument list and return whatever `fn` returns. Callers always
// get their concrete function type back via the `T` generic below.
// oxlint-disable-next-line typescript/no-explicit-any
type AnyFn = (...args: any[]) => any;

/**
 * React 18 equivalent of React 19's `useEffectEvent`. Returns a stable-identity
 * wrapper whose current target is always the latest `fn` received. Prereq for
 * `memo()` to actually skip work when callbacks cross the memo boundary.
 *
 * https://reactjs.org/docs/hooks-faq.html#what-can-i-do-if-my-effect-dependencies-change-too-often
 */
export function useLatestFunc<T extends AnyFn>(fn: T): T;
export function useLatestFunc<T extends AnyFn>(
  fn: T | null | undefined,
): T | null | undefined;
export function useLatestFunc<T extends AnyFn>(
  fn: T | null | undefined,
): T | null | undefined {
  const ref = useRef(fn);

  useLayoutEffect(() => {
    ref.current = fn;
  });

  const stable = useCallback(
    ((...args: Parameters<T>) => ref.current!(...args)) as T,
    [],
  );

  return fn ? stable : fn;
}
