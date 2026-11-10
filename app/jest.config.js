module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/helpers/'],
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-svg|react-native-sse|@notifee)/)'],
};
