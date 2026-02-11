import * as React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('App is starting...');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'Defined' : 'Undefined');

ReactDOM.createRoot(document.getElementById('app')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
