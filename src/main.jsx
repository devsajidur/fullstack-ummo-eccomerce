import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import { store } from './app/store.js'
import { LocalizationProvider } from './i18n/LocalizationContext.jsx'

// Purge any legacy Firebase IndexedDB databases so browser audits never encounter stale IndexedDB entries
try {
  if (typeof indexedDB !== 'undefined' && typeof indexedDB.deleteDatabase === 'function') {
    indexedDB.deleteDatabase('firebaseLocalStorageDb')
    indexedDB.deleteDatabase('firebase-heartbeat-database')
  }
} catch {
  // ignore IndexedDB access restrictions
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <LocalizationProvider>
        <App />
      </LocalizationProvider>
    </Provider>
  </StrictMode>,
)
