import React from 'react'
import { Spinner, Text } from '@shopify/polaris'

const LoadingSpinner = () => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <Spinner size="large" />
        <Text variant="bodyMd" as="p" color="subdued">
          Loading affiliatehub App...
        </Text>
      </div>
    </div>
  )
}

export default LoadingSpinner
