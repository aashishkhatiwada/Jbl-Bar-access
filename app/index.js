/**
 * @format
 */

import {AppRegistry} from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import App from './App';
import {name as appName} from './app.json';
import {headlessTask} from './src/notifications/background';

AppRegistry.registerComponent(appName, () => App);
// Battery checks while the app process is not running.
BackgroundFetch.registerHeadlessTask(headlessTask);
