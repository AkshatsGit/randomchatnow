import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Chat1on1 from './pages/Chat1on1';
import GroupChat from './pages/GroupChat';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';
import { AuthProvider } from './context/AuthContext';

// Helper to only show Navbar on certain routes
const Layout = ({ children }) => {
    const location = useLocation();
    const isAdmin = location.pathname.startsWith('/adminxakshat');
    const isChat = location.pathname === '/chat';

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30">
            {children}
            {!isAdmin && !isChat && <Navbar />}
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
