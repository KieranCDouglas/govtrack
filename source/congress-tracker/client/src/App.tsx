import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import MembersPage from "@/pages/MembersPage";
import MemberDetailPage from "@/pages/MemberDetailPage";
import CompassPage from "@/pages/CompassPage";
import QuizPage from "@/pages/QuizPage";
import BallotPage from "@/pages/BallotPage";
import AboutPage from "@/pages/AboutPage";
import NotFound from "@/pages/not-found";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useHashLocation}>
          <Layout>
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/members" component={MembersPage} />
              <Route path="/members/:bioguideId" component={MemberDetailPage} />
              <Route path="/compass" component={CompassPage} />
              <Route path="/quiz" component={QuizPage} />
              <Route path="/ballot" component={BallotPage} />
              <Route path="/about" component={AboutPage} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
          <Toaster />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
