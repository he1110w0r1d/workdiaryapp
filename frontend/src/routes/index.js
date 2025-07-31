import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import DiaryList from './components/DiaryList';
import DiaryForm from './components/DiaryForm';
import SummaryList from './components/SummaryList';
import Calendar from './components/Calendar';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="diaries" element={<DiaryList />} />
          <Route path="diaries/new" element={<DiaryForm />} />
          <Route path="diaries/:id/edit" element={<DiaryForm />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="summaries" element={<SummaryList />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;