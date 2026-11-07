import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Layering (see README "Project structure"). Imports only point "down":
//   app → features → components, lib
//   app, features → server → db, lib
// Type-only imports are always allowed: they vanish at build time.
const RULE = "@typescript-eslint/no-restricted-imports";
const dbValues = {
  group: ["@/db", "@/db/*"],
  allowTypeImports: true,
  message: "Only src/server/** may query the database (SEC-1). Call a server query/action instead.",
};
const block = (group, message) => ({ group, allowTypeImports: true, message });

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/**", "src/features/**"],
    rules: { [RULE]: ["error", { patterns: [dbValues] }] },
  },
  {
    files: ["src/components/**"],
    rules: {
      [RULE]: [
        "error",
        { patterns: [dbValues, block(["@/features/*"], "Shared components must not depend on a feature.")] },
      ],
    },
  },
  {
    files: ["src/lib/**"],
    rules: {
      [RULE]: [
        "error",
        {
          patterns: [
            dbValues,
            block(["@/server/*", "@/features/*", "@/components/*"], "src/lib is framework-free code usable anywhere."),
          ],
        },
      ],
    },
  },
  {
    files: ["src/server/**"],
    rules: {
      [RULE]: [
        "error",
        { patterns: [block(["@/features/*", "@/components/*", "@/app/*"], "Server code must not import UI.")] },
      ],
    },
  },
  {
    files: ["src/db/**"],
    rules: {
      [RULE]: [
        "error",
        { patterns: [block(["@/server/*", "@/features/*", "@/components/*", "@/app/*"], "src/db is the bottom layer.")] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
