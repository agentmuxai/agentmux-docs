import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { MetaProvider } from "@solidjs/meta";
import App from "./App";
import "./index.css";

render(
  () => (
    <MetaProvider>
      <Router root={App}>
        <Route path="/*path" component={() => null} />
      </Router>
    </MetaProvider>
  ),
  document.getElementById("root")!,
);
