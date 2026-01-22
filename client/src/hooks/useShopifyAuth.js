import { useState, useEffect } from 'react'
import axios from 'axios'

export const useShopifyAuth = () => {
  const [shop, setShop] = useState('')
  const [isInstalled, setIsInstalled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const checkInstallation = async () => {
      try {
        // Get shop from URL parameters
        const urlParams = new URLSearchParams(window.location.search)
        const shopParam = urlParams.get('shop')
        const installedParam = urlParams.get('installed')
        
        if (shopParam) {
          setShop(shopParam)
          
          // If installed=true is in URL (from OAuth callback), mark as installed immediately
          if (installedParam === 'true') {
            setIsInstalled(true)
            setLoading(false)
            return
          }
          
          // Otherwise, check actual installation status via API
          try {
            const response = await axios.get(`/api/verify-installation?shop=${shopParam}`)
            if (response.data.installed) {
              setIsInstalled(true)
            } else {
              setIsInstalled(false)
            }
          } catch (err) {
            // If API fails, don't assume installed
            setIsInstalled(false)
          }
          
          setLoading(false)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Error checking installation:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    checkInstallation()
  }, []) // Run on mount - component will re-render when route changes

  const installApp = async () => {
    if (!shop) return
    
    try {
      setLoading(true)
      // Redirect to Shopify OAuth
      window.location.href = `/auth?shop=${shop}`
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return {
    shop,
    isInstalled,
    loading,
    error,
    installApp
  }
}
