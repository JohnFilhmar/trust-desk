/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  // Integration tests need a real MySQL, so they run from their own config.
  testPathIgnorePatterns: ["/node_modules/", "\\.integration\\.test\\.ts$"],
  moduleNameMapper: {
    "^#app/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "commonjs" },
      },
    ],
  },
};
