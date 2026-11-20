// react-native-reanimated en Jest (moduleNameMapper de jest.config.js). La implementación está en
// reanimatedMock.tsx, que es además "react-native-reanimated/mock": deben ser archivos distintos,
// porque el mock de expo-router/testing-library pide uno dentro del otro (con el mismo archivo,
// se pedía a sí mismo y quedaba vacío).
export * from "./reanimatedMock";
export { default } from "./reanimatedMock";
