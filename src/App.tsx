import { Home } from './components/Home';
import { LessonView } from './components/LessonView';
import { PracticePage } from './components/Practice';
import { ProgressPage } from './components/Progress';
import { ReviewPage, useDueCount } from './components/Review';
import { useRoute } from './lib/router';

export default function App() {
  const route = useRoute();
  const due = useDueCount();
  const tab = route.name === 'lesson' || route.name === 'home' ? 'learn' : route.name;
  const T = ({ id, href, label, dot }: { id: string; href: string; label: string; dot?: boolean }) => (
    <a className={`tab ${tab === id ? 'active' : ''}`} href={href}>{label}{dot && <span className="dot" />}</a>
  );
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">
            <span className="brand-mark">
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 4h10M3 8h10M3 12h6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
            <span>DDIA <span className="full">Course</span></span>
          </a>
          <nav className="tabs">
            <T id="learn" href="#/" label="Learn" />
            <T id="review" href="#/review" label="Review" dot={due > 0} />
            <T id="practice" href="#/practice" label="Practice" />
            <T id="progress" href="#/progress" label="Progress" />
          </nav>
        </div>
      </header>
      <main className="page">
        {route.name === 'home' && <Home />}
        {route.name === 'lesson' && <LessonView key={route.id} id={route.id} />}
        {route.name === 'review' && <ReviewPage />}
        {route.name === 'practice' && <PracticePage id={route.id} />}
        {route.name === 'progress' && <ProgressPage />}
      </main>
    </>
  );
}
