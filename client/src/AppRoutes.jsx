import React, { createContext, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { NavigationMenu, useAppBridge } from "@shopify/app-bridge-react";
import { NavigationMenu as NavigationMenuAction } from "@shopify/app-bridge/actions";
import WelcomePage from "./components/WelcomePage";
import InstallationPage from "./components/InstallationPage";
import LoadingSpinner from "./components/LoadingSpinner";
import CustomPricingPage from "./components/CustomPricingPage";
import { useShopifyAuth } from "./hooks/useShopifyAuth";

export const Storename = createContext();

// Component to set up navigation using App Bridge actions API (fallback)
function NavigationMenuSetup() {
  const app = useAppBridge();
  const location = useLocation();

  useEffect(() => {
    if (!app) {
      console.log("NavigationMenuSetup: No app bridge instance");
      return;
    }

    try {
      console.log("NavigationMenuSetup: Creating navigation menu via actions API");
      
      const customPricingLink = {
        label: "Custom Pricing",
        destination: "/custom-pricing",
      };

      const navMenu = NavigationMenuAction.create(app, {
        items: [customPricingLink],
      });

      console.log("NavigationMenuSetup: Navigation menu created", navMenu);

      if (location.pathname === "/custom-pricing" || location.pathname.startsWith("/custom-pricing")) {
        navMenu.set({ active: customPricingLink });
      }

    } catch (error) {
      console.error("NavigationMenuSetup: Error creating navigation", error);
    }
  }, [app, location.pathname]);

  return null;
}

// Component to redirect from /running to / while preserving query params
function RunningRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: "/", search: location.search }} replace />;
}

function AppRoutes() {
  const { shop, isInstalled, loading, error } = useShopifyAuth();

  console.log("=== AppRoutes Debug ===");
  console.log("Shop:", shop);
  console.log("Is Installed:", isInstalled);
  console.log("Loading:", loading);
  console.log("Error:", error);
  console.log("=======================");

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    console.log("Showing error:", error);
    return <div>Error: {error}</div>;
  }

  console.log("=== NavigationMenu Debug ===");
  console.log("Rendering NavigationMenu with links:", [
    { label: "Custom Pricing", destination: "/custom-pricing" },
  ]);
  console.log("============================");

  return (
    <Storename.Provider value={{ STORENAME: shop }}>
      <NavigationMenu
        navigationLinks={[
          {
            label: "Custom Pricing",
            destination: "/custom-pricing",
          },
        ]}
        matcher={(link, location) => link.destination === location.pathname}
      />
      <NavigationMenuSetup />
      <Routes>
        <Route
          path="/"
          element={
            isInstalled ? (
              <WelcomePage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/install"
          element={
            isInstalled ? (
              <WelcomePage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/custom-pricing"
          element={
            isInstalled ? (
              <CustomPricingPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route path="/running" element={<RunningRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Storename.Provider>
  );
}

export default AppRoutes;
