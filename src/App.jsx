import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Chat1on1 from './pages/Chat1on1';
import GroupChat from './pages/GroupChat';
import { AuthProvider } from './context/AuthContext';

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="min-h-screen bg-gray-900 text-white font-sans">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/chat" element={<Chat1on1 />} />
                        <Route path="/groups" element={<GroupChat />} />
                    </Routes>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;
