const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/lib/startup.js'), 'utf8');
const context = { setTimeout, clearTimeout, console: { warn() {} } };
vm.createContext(context);
vm.runInContext(source.replace(/export function/g, 'function'), context);
const { runStartupTask, startOptionalAnalytics } = context;
const tick = () => new Promise(resolve => setImmediate(resolve));

test('session task returns successful data', async () => {
  const result = await new Promise((resolve, reject) => runStartupTask(() => ({ session: null }), { onSuccess: resolve, onError: reject }));
  assert.equal(result.session, null);
});

for (const [name, work] of [
  ['synchronous throw', () => { throw new Error('failure'); }],
  ['rejected request', () => Promise.reject(new Error('failure'))],
]) test(name + ' is delivered to recovery', async () => {
  const error = await new Promise(resolve => runStartupTask(work, { onSuccess: () => assert.fail(), onError: resolve }));
  assert.equal(error.message, 'failure');
});

test('timeout recovers and ignores a late server response', async () => {
  let resolveWork;
  let successes = 0;
  const pending = new Promise(resolve => { resolveWork = resolve; });
  const error = await new Promise(resolve => runStartupTask(() => pending, {
    onSuccess: () => successes++, onError: resolve, timeoutMs: 5,
  }));
  assert.equal(error.message, 'Startup timed out');
  resolveWork('late');
  await tick();
  assert.equal(successes, 0);
});

test('cancellation ignores stale success and rejection', async () => {
  for (const reject of [false, true]) {
    let settle;
    const pending = new Promise((yes, no) => { settle = reject ? no : yes; });
    const cancel = runStartupTask(() => pending, { onSuccess: () => assert.fail(), onError: () => assert.fail() });
    cancel();
    settle(new Error('stale'));
    await tick();
  }
});

test('disabled analytics never loads; failed analytics stays nonfatal', async () => {
  let calls = 0;
  startOptionalAnalytics(() => calls++, false);
  startOptionalAnalytics(() => { calls++; throw new Error('native module unavailable'); }, true);
  startOptionalAnalytics(() => { calls++; return Promise.reject(new Error('rejected init')); }, true);
  await tick();
  assert.equal(calls, 2);
});

function loadRoot(loadApp, hideAsync = () => Promise.resolve()) {
  class Component {
    setState(update) { this.state = { ...this.state, ...(typeof update === 'function' ? update(this.state) : update) }; }
  }
  const sandbox = {
    React: { Component, createElement: (type, props, ...children) => ({ type, props, children }) },
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
    StyleSheet: { create: value => value }, SplashScreen: { hideAsync },
    console: { warn() {} }, require: loadApp,
  };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(root, 'StartupRoot.js'), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export class', 'class').replace('export default function', 'function');
  vm.runInContext(code + '\nthis.Boundary = StartupBoundary;', sandbox);
  return sandbox;
}

test('root registers independently of a failing App import', () => {
  let loads = 0;
  const sandbox = loadRoot(() => { loads++; throw new Error('missing config'); });
  const element = sandbox.StartupRoot();
  assert.equal(loads, 0);
  assert.equal(element.type, 'View');
  const boundary = new sandbox.Boundary();
  assert.throws(() => boundary.render().type(), /missing config/);
  boundary.state = { ...boundary.state, ...sandbox.Boundary.getDerivedStateFromError() };
  assert.equal(boundary.render().children[0].children[0], 'NearMatch couldn’t start');
  boundary.retry();
  assert.equal(boundary.state.failed, false);
  assert.equal(boundary.render().props.key, 1);
});

test('layout dismisses splash, including when the error screen is shown', async () => {
  let hides = 0;
  const sandbox = loadRoot(() => ({}), () => { hides++; return Promise.reject(new Error('already dismissed')); });
  sandbox.StartupRoot().props.onLayout();
  await tick();
  assert.equal(hides, 1);
});

test('entrypoint uses recovery root; App handles font and backend errors', () => {
  const entry = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
  assert.match(entry, /registerRootComponent\(StartupRoot\)/);
  assert.doesNotMatch(entry, /import App from/);
  assert.match(app, /\[fontsLoaded, fontError\]/);
  assert.match(app, /if \(startupError \|\| fontError\) throw/);
  assert.match(app, /return runStartupTask\(\(\) => supabase/);
  assert.doesNotMatch(app, /import .* from 'vexo-analytics'/);
});
