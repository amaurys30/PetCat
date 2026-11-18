// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require("eslint/config");
const { fixupPluginRules } = require("@eslint/compat");
const expoConfig = require("eslint-config-expo/flat");
const reactNativeA11y = require("eslint-plugin-react-native-a11y");

// eslint-plugin-react-native-a11y está escrito para ESLint 8: @eslint/compat adapta sus
// reglas a ESLint 9. Si deja de funcionar, reemplazarlo por reglas propias (ver PLAN.md).
module.exports = defineConfig([
  globalIgnores(["dist/*", ".expo/*", "expo-env.d.ts", "coverage/*"]),
  expoConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-native-a11y": fixupPluginRules(reactNativeA11y) },
    rules: {
      ...reactNativeA11y.configs.all.rules,
      // Las pistas (hint) son opcionales en iOS y Android: se ponen solo cuando la etiqueta
      // no basta para saber qué pasa al tocar.
      "react-native-a11y/has-accessibility-hint": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);
