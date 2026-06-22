// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Jest's jsdom environment omits TextEncoder/TextDecoder, which react-router v7's
// core (via turbo-stream) references at import time. Polyfill from Node's util.
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// jsdom does not implement IntersectionObserver, which the homepage scroll-reveal
// hook relies on. Provide a no-op mock so rendering <App /> does not throw.
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

global.IntersectionObserver = IntersectionObserverMock;
window.IntersectionObserver = IntersectionObserverMock;

// jsdom does not implement scrolling; stub it to avoid noisy "Not implemented"
// errors when components call window.scrollTo during effects.
window.scrollTo = () => {};
