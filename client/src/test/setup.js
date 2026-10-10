import '@testing-library/jest-dom';

if (typeof window !== 'undefined') {
  window.matchMedia =
    window.matchMedia ||
    function () {
      return {
        matches: false,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {},
      };
    };

  window.ResizeObserver =
    window.ResizeObserver ||
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

  window.IntersectionObserver =
    window.IntersectionObserver ||
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

  if (!document.fonts) {
    document.fonts = {
      ready: Promise.resolve(),
      check: () => true,
      load: () => Promise.resolve([]),
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  }
}
