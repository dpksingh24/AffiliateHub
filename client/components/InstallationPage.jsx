import React from 'react'
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  Banner
} from '@shopify/polaris'

const InstallationPage = ({ shop }) => {
  const handleInstall = () => {
    if (shop) {
      window.location.href = `/auth?shop=${shop}`
    }
  }

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ fontSize: '3rem', color: '#2c5aa0' }}>➕</div>
            
            <Text variant="bodyMd" as="p" color="subdued">
              Install our custom app to enhance your Shopify store with powerful features.
            </Text>

            {shop && (
              <Banner title="Store Detected" status="info">
                <p>Installing for: <strong>{shop}</strong></p>
              </Banner>
            )}

            <Button
              primary
              size="large"
              onClick={handleInstall}
              disabled={!shop}
            >
              Install App
            </Button>

            <Text variant="bodySm" as="p" color="subdued">
              This will redirect you to Shopify to authorize the installation.
            </Text>
          </div>
        </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}

export default InstallationPage
