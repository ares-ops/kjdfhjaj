import React from "react";
import { BrowserRouter as Router, Route, Switch, Redirect } from "react-router-dom";
import Header from "./components/Header";
import Stake from "./components/Stake";
import Unstake from "./components/Unstake";
import ClaimRewards from "./components/ClaimRewards";
import AdminDashboard from "./components/AdminDashboard";
import Layout from "./components/Layout";
import { useWallet } from "@solana/wallet-adapter-react";
import AdvancedRewardsView from "./components/AdvancedRewardsView";
import { CONFIG } from "./utils/config";

const admins = CONFIG.ADMINS;

console.log(admins);

function App() {
  const wallet = useWallet();
  const currentAddress = wallet?.publicKey?.toBase58() || null;

  return (
    <Router>
      <Layout>
        <Header />
        <hr className="bg-white" />
        <Switch>
          <Route path="/stake" component={Stake} />
          <Route path="/unstake" component={Unstake} />
          <Route path="/claim-rewards" component={ClaimRewards} />
          <Route path="/advanced-rewards-view" component={AdvancedRewardsView} />
          <PrivateRoute path="/admin-dashboard" component={AdminDashboard} address={currentAddress} />
          <Redirect from="/" to="/stake" />
        </Switch>
      </Layout>
    </Router>
  );
}

// For Testing Purpose Allow Everyone
function PrivateRoute({ component: Component, address, ...rest }) {
  return <Route {...rest} render={(props) => (true ? <Component {...props} /> : <Redirect to="/" />)} />;
}

// function PrivateRoute({ component: Component, address, ...rest }) {
//   return <Route {...rest} render={(props) => (admins.includes(address) ? <Component {...props} /> : <Redirect to="/" />)} />;
// }

export default App;
