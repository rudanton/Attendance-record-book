import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// 플러그인 임포트
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // 1. Next.js 기본 설정 + Prettier 설정 상속
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),

  // 2. 커스텀 플러그인 및 룰 설정
  {
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
            // 1. React, Next.js 패키지
            ["^react", "^next"],
            // 2. 외부 라이브러리 (a-z)
            ["^@?\\w"],
            // 3. 내부 모듈 (컴포넌트, 유틸 등 - 절대 경로 @/)
            ["^@/"],
            // 4. 상대 경로 imports (../../ 등)
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
            // 5. 스타일 imports
            ["^.+\\.s?css$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
    },
  },
];

export default eslintConfig;