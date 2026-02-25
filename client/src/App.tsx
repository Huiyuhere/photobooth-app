import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
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
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "";
  return (
    <ErrorBoundary>
      <WouterRouter base={base}>
        <Routes />
      </WouterRouter>
    </ErrorBoundary>
  );
}

export default App;
