import { FlightProvider } from './context/FlightContext';
import { LanguageProvider } from './context/LanguageContext';
import { DashboardLayout } from './components/DashboardLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <FlightProvider>
          <DashboardLayout />
        </FlightProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
