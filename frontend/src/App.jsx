import { BrowserRouter } from 'react-router-dom'
import { ToastViewport } from './components/communs/ToastViewport'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { AppRouter } from './routes/AppRouter'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRouter />
          <ToastViewport />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
