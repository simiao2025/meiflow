module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { 
        jsxRuntime: 'automatic',
        reactCompiler: false // Desativado para evitar conflito de 'read-only' property NONE no Hermes
      }]
    ],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  };
};
