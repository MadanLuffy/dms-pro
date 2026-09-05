import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Spinner from './components/Spinner';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';
import { homePath } from './utils/home';
import LoginPage from './pages/LoginPage';
import FileListPage from './pages/FileListPage';
import FileDetailPage from './pages/FileDetailPage';
import NoteThreadPage from './pages/NoteThreadPage';
import NewFilePage from './pages/NewFilePage';
import AuditPage from './pages/AuditPage';
import AdminPage from './pages/AdminPage';

function RoleGate({ allow, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to={homePath(user)} replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking session..." />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePath(user)} replace />;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [newFileOpen, setNewFileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const isAdmin = user?.role === 'SUPERADMIN';
  const onOpenNewFile = () => {
    if (isAdmin) return;
    setNewFileOpen(true);
  };
  const onCloseNewFile = () => setNewFileOpen(false);

  const showHeader = location.pathname !== '/login';

  return (
    <div className="app-shell">
      <ErrorBoundary>
        {showHeader && <Header onOpenNewFile={onOpenNewFile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {newFileOpen && !isAdmin && <NewFilePage onClose={onCloseNewFile} />}

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <RoleGate allow={['SUPERADMIN']}>
                <AdminPage />
              </RoleGate>
            }
          />
          <Route
            path="/files"
            element={
              <RoleGate allow={['STAFF', 'DEPT_HEAD', 'CEO']}>
                <FileListPage searchQuery={searchQuery} onSearchChange={setSearchQuery} />
              </RoleGate>
            }
          />
          <Route
            path="/files/new"
            element={
              <RoleGate allow={['STAFF', 'DEPT_HEAD', 'CEO']}>
                <NewFilePage />
              </RoleGate>
            }
          />
          <Route
            path="/files/:id"
            element={
              <RoleGate allow={['STAFF', 'DEPT_HEAD', 'CEO']}>
                <FileDetailPage />
              </RoleGate>
            }
          />
          <Route
            path="/files/:id/notes/:noteId"
            element={
              <RoleGate allow={['STAFF', 'DEPT_HEAD', 'CEO']}>
                <NoteThreadPage />
              </RoleGate>
            }
          />
          <Route
            path="/audit"
            element={
              <RoleGate allow={['SUPERADMIN', 'CEO']}>
                <AuditPage />
              </RoleGate>
            }
          />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}
