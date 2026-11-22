import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'drizzle'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // The flat config file itself is not part of the build tsconfig.
          allowDefaultProject: ['eslint.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The spec forbids `any`. This is the enforcement point.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      // Nest controllers and providers legitimately use empty constructors and
      // decorated classes whose methods are async without awaiting.
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['**/*.{test,spec}.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
);
