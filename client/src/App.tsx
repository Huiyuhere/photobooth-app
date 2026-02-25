import NotFound from "@/pages/NotFound";
import { Route, Switch, Router } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Remove trailing slash from BASE_URL for wouter base
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "";
  return (
    <ErrorBoundary>
      <Router base={base}>
        <Routes />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
