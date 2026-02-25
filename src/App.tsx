import { FlightProvider } from './context/FlightContext';
import { DashboardLayout } from './components/DashboardLayout';

function App() {
  return (
    <FlightProvider>
      <DashboardLayout />
    </FlightProvider>
  );
}

export default App;
