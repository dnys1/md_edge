
export const PREAMBLE = `
var dartNodeIsActuallyNode = typeof process !== "undefined" && (process.versions || {}).hasOwnProperty('node');

// make sure to keep this as 'var'
// we don't want block scoping
var self = dartNodeIsActuallyNode ? Object.create(globalThis) : globalThis;

// CommonJS globals.
if (typeof require !== "undefined") {
  self.require = require;
}
if (typeof exports !== "undefined") {
  self.exports = exports;
}

// Node.js specific exports, check to see if they exist & or polyfilled

if (typeof process !== "undefined") {
  self.process = process;
}

if (typeof __dirname !== "undefined") {
  self.__dirname = __dirname;
}

if (typeof __filename !== "undefined") {
  self.__filename = __filename;
}

if (typeof Buffer !== "undefined") {
  self.Buffer = Buffer;
}
`;