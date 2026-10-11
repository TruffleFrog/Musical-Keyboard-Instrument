import { useRef, useSyncExternalStore } from 'react';

/** Minimal external store: no dependency, selector-based React hook. */
export interface Store<T> {
  get(): T;
  set(update: Partial<T> | ((prev: T) => Partial<T>)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(update) {
      const patch = typeof update === 'function' ? update(state) : update;
      let changed = false;
      for (const key of Object.keys(patch) as Array<keyof T>) {
        if (!Object.is(state[key], patch[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Subscribes to a slice of a store. The selector should return a primitive or
 * a reference that only changes when the underlying data does.
 */
export function useStore<T extends object, S>(
  store: Store<T>,
  selector: (state: T) => S
): S {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  return useSyncExternalStore(
    store.subscribe,
    () => selectorRef.current(store.get()),
    () => selectorRef.current(store.get())
  );
}
