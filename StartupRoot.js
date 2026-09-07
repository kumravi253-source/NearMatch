import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Do not import App here: its dependency initialization can throw before the
// root is registered. Load it inside a descendant covered by the boundary.
function AppLoader() {
  const App = require('./App').default;
  return React.createElement(App);
}

export class StartupBoundary extends React.Component {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() {
    // Avoid printing backend errors, user data, or configuration values.
    console.warn('NearMatch startup/render failed');
  }

  retry = () => this.setState(state => ({ failed: false, attempt: state.attempt + 1 }));

  render() {
    if (this.state.failed) {
      return React.createElement(View, { style: styles.message, accessibilityLiveRegion: 'polite' },
        React.createElement(Text, { style: styles.title }, 'NearMatch couldn’t start'),
        React.createElement(Text, { style: styles.body },
          'Check your connection and try again. If this continues, contact getsupport@nearmatch.in and mention startup error NM-START.'),
        React.createElement(TouchableOpacity, {
          onPress: this.retry, style: styles.button, accessibilityRole: 'button', accessibilityLabel: 'Try again',
        }, React.createElement(Text, { style: styles.buttonText }, 'Try again')),
      );
    }
    return React.createElement(AppLoader, { key: this.state.attempt });
  }
}

export default function StartupRoot() {
  const onLayout = () => {
    // Reveal either the app's loading UI or the error UI, never hide into blank.
    Promise.resolve().then(() => SplashScreen.hideAsync()).catch(() => {
      console.warn('Native splash could not be dismissed');
    });
  };
  return React.createElement(View, { style: styles.root, onLayout }, React.createElement(StartupBoundary));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8F2' },
  message: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  title: { fontSize: 24, fontWeight: '700', color: '#84351F', textAlign: 'center', marginBottom: 16 },
  body: { fontSize: 16, color: '#42332D', textAlign: 'center', marginBottom: 24 },
  button: { padding: 16, borderRadius: 12, backgroundColor: '#E8603A' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
