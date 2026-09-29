const base = require("./jest.config.cjs");

/** @type {import("jest").Config} */
module.exports = {
  ...base,
  testMatch: ["**/*.integration.test.ts"],
  testPathIgnorePatterns: ["/node_modules/"],
};
