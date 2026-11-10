/* eslint-env jest */
// Native modules are not available under Jest; logic is tested on the
// machine, rendering and accessibility on the device.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: async k => (store.has(k) ? store.get(k) : null),
      setItem: async (k, v) => void store.set(k, v),
      removeItem: async k => void store.delete(k),
    },
  };
});
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'id'),
    displayNotification: jest.fn(async () => 'id'),
    getNotificationSettings: jest.fn(async () => ({authorizationStatus: 1})),
    requestPermission: jest.fn(async () => ({authorizationStatus: 1})),
    getInitialNotification: jest.fn(async () => null),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
    isBatteryOptimizationEnabled: jest.fn(async () => false),
    openBatteryOptimizationSettings: jest.fn(),
    openNotificationSettings: jest.fn(),
  },
  AndroidImportance: {DEFAULT: 3},
  AuthorizationStatus: {AUTHORIZED: 1, DENIED: 0},
  EventType: {PRESS: 1},
}));
jest.mock('react-native-background-fetch', () => ({
  __esModule: true,
  default: {configure: jest.fn(async () => 2), stop: jest.fn(async () => true), finish: jest.fn(), registerHeadlessTask: jest.fn(), NETWORK_TYPE_ANY: 1},
}));
jest.mock('react-native-sse', () => jest.fn());
jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {__esModule: true, default: props => React.createElement(View, {...props, testID: 'native-slider'})};
});
