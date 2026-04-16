"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/zustand";
exports.ids = ["vendor-chunks/zustand"];
exports.modules = {

/***/ "(ssr)/./node_modules/zustand/esm/vanilla.mjs":
/*!**********************************************!*\
  !*** ./node_modules/zustand/esm/vanilla.mjs ***!
  \**********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   createStore: () => (/* binding */ createStore)\n/* harmony export */ });\nconst createStoreImpl = (createState) => {\n  let state;\n  const listeners = /* @__PURE__ */ new Set();\n  const setState = (partial, replace) => {\n    const nextState = typeof partial === \"function\" ? partial(state) : partial;\n    if (!Object.is(nextState, state)) {\n      const previousState = state;\n      state = (replace != null ? replace : typeof nextState !== \"object\" || nextState === null) ? nextState : Object.assign({}, state, nextState);\n      listeners.forEach((listener) => listener(state, previousState));\n    }\n  };\n  const getState = () => state;\n  const getInitialState = () => initialState;\n  const subscribe = (listener) => {\n    listeners.add(listener);\n    return () => listeners.delete(listener);\n  };\n  const api = { setState, getState, getInitialState, subscribe };\n  const initialState = state = createState(setState, getState, api);\n  return api;\n};\nconst createStore = ((createState) => createState ? createStoreImpl(createState) : createStoreImpl);\n\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvenVzdGFuZC9lc20vdmFuaWxsYS5tanMiLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOEhBQThIO0FBQzlIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQjtBQUNoQjtBQUNBO0FBQ0E7QUFDQTs7QUFFdUIiLCJzb3VyY2VzIjpbIi93b3Jrc3BhY2UvY3VzdG9tZXIvbm9kZV9tb2R1bGVzL3p1c3RhbmQvZXNtL3ZhbmlsbGEubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGNyZWF0ZVN0b3JlSW1wbCA9IChjcmVhdGVTdGF0ZSkgPT4ge1xuICBsZXQgc3RhdGU7XG4gIGNvbnN0IGxpc3RlbmVycyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGNvbnN0IHNldFN0YXRlID0gKHBhcnRpYWwsIHJlcGxhY2UpID0+IHtcbiAgICBjb25zdCBuZXh0U3RhdGUgPSB0eXBlb2YgcGFydGlhbCA9PT0gXCJmdW5jdGlvblwiID8gcGFydGlhbChzdGF0ZSkgOiBwYXJ0aWFsO1xuICAgIGlmICghT2JqZWN0LmlzKG5leHRTdGF0ZSwgc3RhdGUpKSB7XG4gICAgICBjb25zdCBwcmV2aW91c1N0YXRlID0gc3RhdGU7XG4gICAgICBzdGF0ZSA9IChyZXBsYWNlICE9IG51bGwgPyByZXBsYWNlIDogdHlwZW9mIG5leHRTdGF0ZSAhPT0gXCJvYmplY3RcIiB8fCBuZXh0U3RhdGUgPT09IG51bGwpID8gbmV4dFN0YXRlIDogT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUsIG5leHRTdGF0ZSk7XG4gICAgICBsaXN0ZW5lcnMuZm9yRWFjaCgobGlzdGVuZXIpID0+IGxpc3RlbmVyKHN0YXRlLCBwcmV2aW91c1N0YXRlKSk7XG4gICAgfVxuICB9O1xuICBjb25zdCBnZXRTdGF0ZSA9ICgpID0+IHN0YXRlO1xuICBjb25zdCBnZXRJbml0aWFsU3RhdGUgPSAoKSA9PiBpbml0aWFsU3RhdGU7XG4gIGNvbnN0IHN1YnNjcmliZSA9IChsaXN0ZW5lcikgPT4ge1xuICAgIGxpc3RlbmVycy5hZGQobGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiBsaXN0ZW5lcnMuZGVsZXRlKGxpc3RlbmVyKTtcbiAgfTtcbiAgY29uc3QgYXBpID0geyBzZXRTdGF0ZSwgZ2V0U3RhdGUsIGdldEluaXRpYWxTdGF0ZSwgc3Vic2NyaWJlIH07XG4gIGNvbnN0IGluaXRpYWxTdGF0ZSA9IHN0YXRlID0gY3JlYXRlU3RhdGUoc2V0U3RhdGUsIGdldFN0YXRlLCBhcGkpO1xuICByZXR1cm4gYXBpO1xufTtcbmNvbnN0IGNyZWF0ZVN0b3JlID0gKChjcmVhdGVTdGF0ZSkgPT4gY3JlYXRlU3RhdGUgPyBjcmVhdGVTdG9yZUltcGwoY3JlYXRlU3RhdGUpIDogY3JlYXRlU3RvcmVJbXBsKTtcblxuZXhwb3J0IHsgY3JlYXRlU3RvcmUgfTtcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/zustand/esm/vanilla.mjs\n");

/***/ })

};
;