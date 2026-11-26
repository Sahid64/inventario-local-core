const { contextBridge } = require('electron');

function getArgValue(prefix) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

const apiUrl = getArgValue('--api-url=');
const backendOrigin = getArgValue('--backend-origin=');
const appSecret = getArgValue('--app-secret=');

contextBridge.exposeInMainWorld('__DESKTOP_API__', {
  apiUrl,
  backendOrigin,
  appSecret,
  isDesktop: true,
});
