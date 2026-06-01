import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist', 'node_modules', '*.config.js', '*.config.ts',
      // Dead reference file — no longer mounted, intentionally kept for reference only
      'src/components/GameScreen/ResultOverlay.tsx',
    ],
  },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks':    reactHooks,
      'react-refresh':  reactRefresh,
    },
    rules: {
      // ── React ──────────────────────────────────────────────────────────────
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ── Unused variables ───────────────────────────────────────────────────
      // Prefix with _ to intentionally suppress (e.g. _unused, _context)
      '@typescript-eslint/no-unused-vars': ['error', {
        vars:                       'all',
        args:                       'after-used',
        argsIgnorePattern:          '^_',
        varsIgnorePattern:          '^_',
        caughtErrorsIgnorePattern:  '^_',
        destructuredArrayIgnorePattern: '^_',
      }],

      // ── Type safety ────────────────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any':        'error',
      '@typescript-eslint/no-non-null-assertion':  'warn',

      // ── Allowed patterns ───────────────────────────────────────────────────
      // Empty functions are common in test mocks and stubs
      '@typescript-eslint/no-empty-function':      'off',
      // console.warn / console.error are used intentionally for encoder errors
      'no-console':                                ['warn', { allow: ['warn', 'error'] }],
      // Returning a ref value from a hook is intentional (audioRef.current pattern)
      'react-hooks/refs':                          'off',
      // Calling setState in an effect is valid React — e.g. derived URL objects
      'react-hooks/set-state-in-effect':           'off',
    },
  },
);
