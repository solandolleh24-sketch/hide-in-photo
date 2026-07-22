import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Editor from './pages/Editor';
import Play from './pages/Play';
import MyChallenges from './pages/MyChallenges';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<Editor />} />
      <Route path="/c/:id" element={<Play />} />
      <Route path="/my" element={<MyChallenges />} />
    </Routes>
  );
}
