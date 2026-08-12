import "@testing-library/jest-dom/vitest"

// jsdom performs no layout, so every element measures 0x0. @tanstack/react-virtual
// sizes its scroll viewport from `offsetWidth`/`offsetHeight` (virtual-core's
// `getRect`) and abandons range calculation entirely once that height is 0,
// mounting no rows at all. Give elements a non-zero box so virtualized lists
// render in tests. A ResizeObserver stub is not needed: virtual-core reads the
// rect synchronously and already guards the missing-observer case.
const VIEWPORT_HEIGHT = 900
const VIEWPORT_WIDTH = 1280

for (const [property, value] of [
  ["clientHeight", VIEWPORT_HEIGHT],
  ["clientWidth", VIEWPORT_WIDTH],
  ["offsetHeight", VIEWPORT_HEIGHT],
  ["offsetWidth", VIEWPORT_WIDTH],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get() {
      return value
    },
  })
}

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: VIEWPORT_WIDTH,
    bottom: VIEWPORT_HEIGHT,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    toJSON: () => ({}),
  }
}
