module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      /**
       * react-three-fiber renders through its own reconciler, so props such as
       * position, intensity, geometry and material are element configuration
       * rather than DOM attributes. The DOM-oriented rule cannot know that and
       * flags every single one, so it is switched off for the 3D layer only.
       */
      files: ['src/three/**/*.jsx'],
      rules: { 'react/no-unknown-property': 'off' },
    },
  ],
  ignorePatterns: ['dist', 'node_modules'],
};
