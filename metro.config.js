const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Test runtimes and the separate server dependency tree are not app source.
config.resolver.blockList = [
  /[/\\]\.artifacts[/\\].*/,
  /[/\\]functions[/\\](node_modules|lib)[/\\].*/,
];
config.maxWorkers = 2;
module.exports = config;
