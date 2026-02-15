import React from 'react'
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Frame,
  Badge,
  Icon,
  Box
} from '@shopify/polaris'
import { NoteIcon } from '@shopify/polaris-icons'
import { useNavigate } from 'react-router-dom'
import { AFFILIATE_FORM_TEMPLATES } from '../constants/affiliateFormTemplates'
import NavBar from './NavBar'

const AffiliateFormTemplatePicker = () => {
  const navigate = useNavigate()

  const handleUseTemplate = (template) => {
    navigate('/affiliate-form/new', { state: { template: template.formPayload } })
  }

  const handleStartFromScratch = () => {
    navigate('/affiliate-form/new')
  }

  return (
    <Frame>
      <NavBar />
      <Page
        title="Create affiliate form"
        backAction={{ content: 'Affiliate Forms', onAction: () => navigate('/affiliate-form') }}
      >
        <Layout>
          <Layout.Section>
            <BlockStack gap="600">
              <Box paddingBlockEnd="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Select a pre-made template to create your form in one click, or start from an empty form.
                </Text>
              </Box>

              {/* Template grid */}
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Choose a template
                </Text>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {AFFILIATE_FORM_TEMPLATES.map((template) => (
                    <Card key={template.id}>
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                background: 'var(--p-color-bg-fill-info-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon source={NoteIcon} tone="info" />
                            </div>
                            <Text as="h3" variant="headingSm" fontWeight="semibold">
                              {template.name}
                            </Text>
                          </InlineStack>
                          <Badge tone="info" size="small">
                            {template.formPayload.fields.length} fields
                          </Badge>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {template.description}
                        </Text>
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={() => handleUseTemplate(template)}
                        >
                          Use this template
                        </Button>
                      </BlockStack>
                    </Card>
                  ))}
                </div>
              </BlockStack>

              {/* Start from scratch */}
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Or start from scratch
                </Text>
                <Card>
                  <InlineStack align="space-between" blockAlign="center" gap="400">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd">
                        Create an empty form and add your own fields.
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Best if you need a fully custom structure.
                      </Text>
                    </BlockStack>
                    <Button variant="secondary" onClick={handleStartFromScratch}>
                      Blank form
                    </Button>
                  </InlineStack>
                </Card>
              </BlockStack>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  )
}

export default AffiliateFormTemplatePicker
