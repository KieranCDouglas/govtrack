import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import MembersPage from './pages/MembersPage'
import CompassPage from './pages/CompassPage'
import QuizPage from './pages/QuizPage'
import MemberDetailPage from './pages/MemberDetailPage'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/members/:bioguideId" element={<MemberDetailPage />} />
            <Route path="/compass" element={<CompassPage />} />
            <Route path="/quiz" element={<QuizPage />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  )
}
