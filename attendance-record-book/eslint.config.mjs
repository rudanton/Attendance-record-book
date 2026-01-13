import { fileURLToPath } from "url";
import path, { dirname } from "path";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tsTypeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      project: path.resolve(__dirname, "./tsconfig.json"),
      tsconfigRootDir: __dirname,
    },
  },
}));

export default [
  // 기본 JS 추천 설정
  js.configs.recommended,

  // TypeScript 추천 + 타입체킹 설정 (소스 폴더 한정)
  ...tsTypeCheckedConfigs,

  // 글로벌 옵션 및 공통 규칙
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {},
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      "no-console": "warn",

      // Unused imports/vars 자동 삭제
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // Import 순서 자동 정렬
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^react", "^next"],
            ["^@?\\w"],
            ["^@/"],
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
            ["^.+\\.s?css$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
    },
  },

  // Next.js와 빌드 산출물 무시
  {
    ignores: [".next/**/*", "node_modules/**/*", "eslint.config.mjs", "**/*.config.*"],
  },
];