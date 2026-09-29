/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  moduleNameMapper: {
    // Jest cannot read a stylesheet. Any CSS import resolves to an empty module.
    "\\.css$": "<rootDir>/src/testUtils/styleStub.cjs",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
          target: "es2022",
        },
        module: { type: "commonjs" },
      },
    ],
  },
};
