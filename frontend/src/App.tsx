import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Users } from '@/pages/Users'
import { Features } from '@/pages/Features'
import { Files } from '@/pages/Files'
import { Activities } from '@/pages/Activities'
import { Settings } from '@/pages/Settings'
import { Login } from '@/pages/Login'
import { useAuth } from '@/hooks/useAuth'

function App() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/features" element={<Features />} />
        <Route path="/files" element={<Files />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App
