import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "drizzle/**", "patches/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Node scripts (deploy/seed) e entrypoint — definem globais de runtime do Node.
    // console é a saída pretendida nesses utilitários de linha de comando.
    files: ["scripts/**/*.mjs", "app.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // console é a saída pretendida nos scripts de CLI (deploy/seed) e no logger.ts,
    // que é o wrapper sancionado em torno do console. Vem por último para sobrepor
    // o bloco geral acima.
    files: ["scripts/**/*.mjs", "app.js", "server/_core/logger.ts"],
    rules: {
      "no-console": "off",
    },
  }
);
