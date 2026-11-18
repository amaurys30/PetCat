// Entorno de Jest de jest-expo que guarda el fetch de Node antes de que el runtime de Expo
// (SDK 58) lo reemplace por expo/fetch, que en Jest es un stub. test/setup.ts lo restaura
// para que MSW pueda interceptar las peticiones.
const NativeEnvironment = require("jest-expo/src/preset/nativeEnvironment");

module.exports = class EntornoPetCat extends NativeEnvironment {
  constructor(config, context) {
    super(config, context);
    const g = this.global;
    g.__webDeNode = { fetch: g.fetch, Request: g.Request, Response: g.Response, Headers: g.Headers };
  }
};
