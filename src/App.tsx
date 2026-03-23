import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import HowToPlayPage from './pages/HowToPlayPage';

export default function App() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/how-to-play" element={<HowToPlayPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
