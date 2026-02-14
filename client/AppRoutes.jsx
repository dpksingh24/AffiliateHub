import React, { createContext, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { NavigationMenu, useAppBridge } from "@shopify/app-bridge-react";
import { NavigationMenu as NavigationMenuAction } from "@shopify/app-bridge/actions";
import WelcomePage from "./components/WelcomePage";
import InstallationPage from "./components/InstallationPage";
import LoadingSpinner from "./components/LoadingSpinner";
import FormBuilderPage from "./components/FormBuilderPage";
import FormEditorPage from "./components/FormEditorPage";
import FormSubmissionsPage from "./components/FormSubmissionsPage";
import CustomPricingPage from "./components/CustomPricingPage";
import { useShopifyAuth } from "./hooks/useShopifyAuth";
import AffiliateFormPage from "./components/AffiliateFormPage";
import AffiliateFormEditorPage from "./components/AffiliateFormEditorPage";
import AffiliateFormSubmissionsPage from "./components/AffiliateFormSubmissionsPage";
import AdminSettingsPage from "./components/AdminSettingsPage";
import PayoutsPage from "./components/PayoutsPage";
import ReferralsPage from "./components/ReferralsPage";
import ReferralDetailPage from "./components/ReferralDetailPage";
import AffiliateReferralsDetailPage from "./components/AffiliateReferralsDetailPage";
import AffiliatesPage from "./components/AffiliatesPage";
import AffiliateDetailPage from "./components/AffiliateDetailPage";
import VisitsPage from "./components/VisitsPage";

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
      
      const formBuilderLink = {
        label: "Form Builder",
        destination: "/form-builder",
      };

      const navMenu = NavigationMenuAction.create(app, {
        items: [formBuilderLink],
      });

      console.log("NavigationMenuSetup: Navigation menu created", navMenu);

      // Set active based on current path
      if (location.pathname === "/form-builder") {
        navMenu.set({ active: formBuilderLink });
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
    { label: "Form Builder", destination: "/form-builder" },
    { label: "Admin Settings", destination: "/admin/settings" },
  ]);
  console.log("============================");

  return (
    <Storename.Provider value={{ STORENAME: shop }}>
      <NavigationMenu
        navigationLinks={[
          {
            label: "Form Builder",
            destination: "/form-builder",
          },
          {
            label: "Referrals",
            destination: "/referrals",
          },
          {
            label: "Affiliates",
            destination: "/affiliates",
          },
          {
            label: "Payouts",
            destination: "/payouts",
          },
          {
            label: "Admin Settings",
            destination: "/admin/settings",
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
          path="/form-builder"
          element={
            isInstalled ? (
              <FormBuilderPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/form-builder/new"
          element={
            isInstalled ? (
              <FormEditorPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/form-builder/:id"
          element={
            isInstalled ? (
              <FormEditorPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/form-builder/:id/submissions"
          element={
            isInstalled ? (
              <FormSubmissionsPage shop={shop} />
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
        {/* affiliate form */}
        <Route
          path="/affiliate-form"
          element={
            isInstalled ? (
              <AffiliateFormPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/affiliate-form/new"
          element={
            isInstalled ? (
              <AffiliateFormEditorPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/affiliate-form/:id"
          element={
            isInstalled ? (
              <AffiliateFormEditorPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/affiliate-form/:id/submissions"
          element={
            isInstalled ? (
              <AffiliateFormSubmissionsPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/admin/settings"
          element={
            isInstalled ? (
              <AdminSettingsPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/payouts"
          element={
            isInstalled ? (
              <PayoutsPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/referrals"
          element={
            isInstalled ? (
              <ReferralsPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/referrals/affiliate/:affiliateId"
          element={
            isInstalled ? (
              <AffiliateReferralsDetailPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/referrals/:id"
          element={
            isInstalled ? (
              <ReferralDetailPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/visits"
          element={
            isInstalled ? (
              <VisitsPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/affiliates"
          element={
            isInstalled ? (
              <AffiliatesPage shop={shop} />
            ) : (
              <InstallationPage shop={shop} />
            )
          }
        />
        <Route
          path="/affiliates/:id"
          element={
            isInstalled ? (
              <AffiliateDetailPage shop={shop} />
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
