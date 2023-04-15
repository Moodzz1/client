const overrides = {
  useMemo: factory => factory(),
  useState: s => [s, () => void 0],
  useReducer: v => [v, () => void 0],
  useEffect: () => { },
  useLayoutEffect: () => { },
  useRef: () => ({ current: null }),
  useCallback: cb => cb,
  useImperativeHandle: () => { },
  useContext: (ctx) => ctx._currentValue
};

const keys = Object.keys(overrides);

function forceRender(component) {
  return (...args) => {
    const ReactDispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
    const originals = keys.map(e => [e, ReactDispatcher[e]]);

    Object.assign(ReactDispatcher, overrides);

    const res = {
      rendered: null,
      error: null
    };

    try {
      res.rendered = component(...args);
    } catch (error) {
      res.error = error;
    }

    Object.assign(ReactDispatcher, Object.fromEntries(originals));

    if (res.error) {
      throw res.error;
    }

    return res.rendered;
  };
};

export default forceRender;