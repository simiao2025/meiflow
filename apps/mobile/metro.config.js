const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// WatermelonDB resolution fix
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'better-sqlite3': '/dev/null', // Mock better-sqlite3 for mobile
};

module.exports = config;
