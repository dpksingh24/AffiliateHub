import {
  ApolloClient,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import React from "react";
import {
  Provider as AppBridgeProvider,
  useAppBridge,
} from "@shopify/app-bridge-react";
import { authenticatedFetch } from "@shopify/app-bridge-utils";
import { Redirect } from "@shopify/app-bridge/actions";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import AppRoutes from "./AppRoutes";
import { BrowserRouter } from "react-router-dom";

export default function App() {
  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;
  const host = new URL(location.href).searchParams.get("host");

  console.log("=== App.jsx Debug ===");
  console.log("API Key:", apiKey || "MISSING");
  console.log("Host:", host || "MISSING");
  console.log("Full URL:", location.href);
  console.log("====================");

  return (
    <PolarisProvider i18n={{}}>
      <AppBridgeProvider
        config={{
          apiKey: apiKey,
          host: host,
          forceRedirect: true,
        }}
      >
        <MyProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </MyProvider>
      </AppBridgeProvider>
    </PolarisProvider>
  );
}

function userLoggedInFetch(app) {
  const fetchFunction = authenticatedFetch(app);
  return async (uri, options) => {
    const response = await fetchFunction(uri, options);
    console.log(response, "res");

    if (
      response.headers.get("X-Shopify-API-Request-Failure-Reauthorize") === "1"
    ) {
      const authUrlHeader = response.headers.get(
        "X-Shopify-API-Request-Failure-Reauthorize-Url"
      );

      const redirect = Redirect.create(app);
      console.log(redirect + " redirect url");
      redirect.dispatch(Redirect.Action.APP, authUrlHeader || `/auth`);
      return null;
    }

    return response;
  };
}

function MyProvider({ children }) {
  const app = useAppBridge();

  console.log("=== MyProvider Debug ===");
  console.log("App Bridge instance:", app);
  console.log("App Bridge app type:", typeof app);
  console.log("========================");

  const urlParams = new URLSearchParams(window.location.search);
  const shop = urlParams.get("shop");

  const fetch = userLoggedInFetch(app);

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      credentials: "include",
      fetch: fetch,
    }),
  });

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
