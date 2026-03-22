const { getDefaultConfig } = require('expo/metro-config');
const nodeLibs = require('node-libs-react-native');

const config = getDefaultConfig(__dirname);
config.resolver.extraNodeModules = {
  ...nodeLibs,
  net: require.resolve('node-libs-react-native/mock/net'),
  tls: require.resolve('node-libs-react-native/mock/tls'),
};
module.exports = config;
