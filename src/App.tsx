import { FlightProvider } from './context/FlightContext';
import { LanguageProvider } from './context/LanguageContext';
import { DashboardLayout } from './components/DashboardLayout';

function App() {
  return (
    <LanguageProvider>
      <FlightProvider>
        <DashboardLayout />
      </FlightProvider>
    </LanguageProvider>
  );
}

export default App;
