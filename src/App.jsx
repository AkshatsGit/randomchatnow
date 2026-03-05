import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Chat1on1 from './pages/Chat1on1';
import GroupChat from './pages/GroupChat';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';
import { AuthProvider } from './context/AuthContext';

const Layout = ({ children }) => {
    const location = useLocation();
    const isAdmin = location.pathname.startsWith('/adminxakshat');
    const isChat = location.pathname === '/chat';

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            {!isAdmin && <Navbar />}
            {children}
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/chat" element={<Chat1on1 />} />
                        <Route path="/groups" element={<GroupChat />} />
                        <Route path="/adminxakshat" element={<AdminDashboard />} />
                    </Routes>
                </Layout>
            </Router>
        </AuthProvider>
    );
}

export default App;
