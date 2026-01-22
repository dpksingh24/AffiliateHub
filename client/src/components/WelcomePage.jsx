import React, { useState, useEffect } from 'react'
import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  BlockStack,
  InlineStack,
  Frame,
  Button,
  Icon,
  Badge,
  Spinner
} from '@shopify/polaris'
import {
  NoteIcon,
  DiscountFilledIcon,
  PlusIcon,
  ChartVerticalFilledIcon,
  PersonFilledIcon,
  ArrowRightIcon,
  CheckCircleIcon
} from '@shopify/polaris-icons'
import { useNavigate } from 'react-router-dom'
import logoIcon from '../assets/images/logo.png'
import NavBar from './NavBar'
import { getForms } from '../services/formApi'

const WelcomePage = ({ shop }) => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [formsData, setFormsData] = useState({ total: 0, active: 0, submissions: 0, recentForms: [] })
  const [pricingData, setPricingData] = useState({ total: 0, active: 0, recentRules: [] })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      try {
        const formsResponse = await getForms()
        const forms = formsResponse.forms || []
        const activeForms = forms.filter(f => f.status === 'Active')
        const totalSubmissions = forms.reduce((acc, f) => acc + (f.totalSubmissions || 0), 0)
        
        setFormsData({
          total: forms.length,
          active: activeForms.length,
          submissions: totalSubmissions,
          recentForms: forms.slice(0, 3)
        })
      } catch (err) {
        console.error('Error fetching forms:', err)
      }

      setPricingData({
        total: 2,
        active: 2,
        recentRules: [
          { id: '1', name: 'Practitioner Discount', discountValue: 33, status: 'active' },
          { id: '2', name: 'Wholesale Pricing', discountValue: 25, status: 'active' }
        ]
      })

    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Frame>
      <NavBar />
      <Page>
        <Layout>
          {/* Hero Section */}
          <Layout.Section>
            <div style={{
              background: 'linear-gradient(to right, rgb(79, 155, 213) 0%, rgb(79, 155, 213) 25%, rgb(79, 155, 213) 50%, rgb(94, 170, 168) 75%, rgb(125, 185, 179) 100%)',
              borderRadius: '16px',
              padding: '40px',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Background decoration */}
              <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '200px',
                height: '200px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '50%'
              }} />
              <div style={{
                position: 'absolute',
                bottom: '-30px',
                left: '30%',
                width: '100px',
                height: '100px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '50%'
              }} />
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <InlineStack gap="400" blockAlign="center">
                  <img 
                    src={logoIcon} 
                    alt="Logo" 
                    style={{ 
                      width: '60px', 
                      height: '60px',
                      background: 'white',
                      borderRadius: '12px',
                      padding: '8px'
                    }} 
                  />
                  <BlockStack gap="200">
                    <Text variant="heading2xl" as="h1" fontWeight="bold">
                      <span style={{ color: 'white' }}>Welcome to KiScience</span>
                    </Text>
                    <Text variant="bodyLg" as="p">
                      <span style={{ color: 'rgba(255,255,255,0.9)' }}>
                        Your all-in-one platform for forms and custom pricing management
                      </span>
                    </Text>
                  </BlockStack>
                </InlineStack>

                {/* Stats Row */}
                {loading ? (
                  <div style={{ marginTop: '30px', textAlign: 'center' }}>
                    <Spinner size="small" />
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginTop: '30px'
                  }}>
                    {[
                      { label: 'Total Forms', value: formsData.total, icon: NoteIcon },
                      { label: 'Active Forms', value: formsData.active, icon: CheckCircleIcon },
                      { label: 'Submissions', value: formsData.submissions, icon: PersonFilledIcon },
                      { label: 'Pricing Rules', value: pricingData.total, icon: DiscountFilledIcon }
                    ].map((stat, index) => (
                      <div key={index} style={{
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ marginBottom: '8px', opacity: 0.9 }}>
                          <Icon source={stat.icon} />
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                          {stat.value}
                        </div>
                        <div style={{ fontSize: '13px', opacity: 0.85 }}>
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Layout.Section>

          {/* Feature Cards */}
          <Layout.Section>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px'
            }}>
              {/* Form Builder Card */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                transition: 'box-shadow 0.3s, transform 0.3s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
              onClick={() => navigate('/form-builder')}
              >
                {/* Card Header */}
                <div style={{
                  background: '#5f9ea0',
                  padding: '24px',
                  color: 'white'
                }}>
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '10px',
                        padding: '10px',
                        display: 'flex'
                      }}>
                        <Icon source={NoteIcon} />
                      </div>
                      <BlockStack gap="100">
                        <Text variant="headingLg" as="h2" fontWeight="bold">
                          <span style={{ color: 'white' }}>Form Builder</span>
                        </Text>
                        <Text variant="bodySm">
                          <span style={{ color: 'rgba(255,255,255,0.8)' }}>Create & manage forms</span>
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <div style={{
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '50%',
                      padding: '8px',
                      display: 'flex'
                    }}>
                      <Icon source={ArrowRightIcon} />
                    </div>
                  </InlineStack>
                </div>

                {/* Card Body */}
                <div style={{ padding: '20px' }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Spinner size="small" />
                    </div>
                  ) : formsData.recentForms.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        background: '#f0f7ff',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                      }}>
                        <Icon source={NoteIcon} tone="info" />
                      </div>
                      <Text variant="bodyMd" tone="subdued">No forms created yet</Text>
                      <div style={{ marginTop: '16px' }}>
                        <Button 
                          variant="primary"
                          icon={PlusIcon}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('/form-builder/new')
                          }}
                        >
                          Create First Form
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <BlockStack gap="300">
                      <Text variant="bodySm" tone="subdued" fontWeight="semibold">RECENT FORMS</Text>
                      {formsData.recentForms.map((form) => (
                        <div 
                          key={form._id || form.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '14px 16px',
                            background: '#f8fafc',
                            borderRadius: '10px',
                            borderLeft: `4px solid ${form.status === 'Active' ? '#22c55e' : '#94a3b8'}`
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/form-builder/${form._id || form.id}/submissions`)
                          }}
                        >
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold">{form.name}</Text>
                            <InlineStack gap="200">
                              <Badge tone={form.status === 'Active' ? 'success' : 'subdued'} size="small">
                                {form.status || 'Draft'}
                              </Badge>
                              <Text variant="bodySm" tone="subdued">
                                {form.totalSubmissions || 0} submissions
                              </Text>
                            </InlineStack>
                          </BlockStack>
                          <Icon source={ChartVerticalFilledIcon} tone="subdued" />
                        </div>
                      ))}
                      <Button 
                        variant="primary"
                        icon={PlusIcon}
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('/form-builder/new')
                        }}
                      >
                        Create New Form
                      </Button>
                    </BlockStack>
                  )}
                </div>
              </div>

              {/* Custom Pricing Card */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                transition: 'box-shadow 0.3s, transform 0.3s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
              onClick={() => navigate('/custom-pricing')}
              >
                {/* Card Header */}
                <div style={{
                  background: '#394142',
                  padding: '24px',
                  color: 'white'
                }}>
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '10px',
                        padding: '10px',
                        display: 'flex'
                      }}>
                        <Icon source={DiscountFilledIcon} />
                      </div>
                      <BlockStack gap="100">
                        <Text variant="headingLg" as="h2" fontWeight="bold">
                          <span style={{ color: 'white' }}>Custom Pricing</span>
                        </Text>
                        <Text variant="bodySm">
                          <span style={{ color: 'rgba(255,255,255,0.8)' }}>Manage pricing rules</span>
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <div style={{
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '50%',
                      padding: '8px',
                      display: 'flex'
                    }}>
                      <Icon source={ArrowRightIcon} />
                    </div>
                  </InlineStack>
                </div>

                {/* Card Body */}
                <div style={{ padding: '20px' }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Spinner size="small" />
                    </div>
                  ) : pricingData.recentRules.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        background: '#fef3e8',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                      }}>
                        <Icon source={DiscountFilledIcon} tone="warning" />
                      </div>
                      <Text variant="bodyMd" tone="subdued">No pricing rules created yet</Text>
                      <div style={{ marginTop: '16px' }}>
                        <Button 
                          variant="primary"
                          icon={PlusIcon}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('/custom-pricing')
                          }}
                        >
                          Create First Rule
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <BlockStack gap="300">
                      <Text variant="bodySm" tone="subdued" fontWeight="semibold">ACTIVE RULES</Text>
                      {pricingData.recentRules.map((rule) => (
                        <div 
                          key={rule.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '14px 16px',
                            background: '#f8fafc',
                            borderRadius: '10px',
                            borderLeft: `4px solid ${rule.status === 'active' ? '#f59e0b' : '#94a3b8'}`
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('/custom-pricing')
                          }}
                        >
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold">{rule.name}</Text>
                            <InlineStack gap="200">
                              <Badge tone="warning" size="small">
                                {rule.discountValue}% off
                              </Badge>
                              <Badge tone={rule.status === 'active' ? 'success' : 'subdued'} size="small">
                                {rule.status === 'active' ? 'Active' : 'Inactive'}
                              </Badge>
                            </InlineStack>
                          </BlockStack>
                          <div style={{
                            background: '#fef3c7',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontWeight: 'bold',
                            color: '#d97706'
                          }}>
                            -{rule.discountValue}%
                          </div>
                        </div>
                      ))}
                      <Button 
                        variant="primary"
                        icon={PlusIcon}
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('/custom-pricing')
                        }}
                      >
                        Create Pricing Rule
                      </Button>
                    </BlockStack>
                  )}
                </div>
              </div>
            </div>
          </Layout.Section>

          {/* Help Section */}
          <Layout.Section>
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderRadius: '12px',
              padding: '24px',
              border: '1px solid #e2e8f0'
            }}>
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h3">Need help getting started?</Text>
                  <Text variant="bodyMd" tone="subdued">
                    Contact our support team at{' '}
                    <a href="mailto:info@kiscience.com" style={{ color: '#667eea', textDecoration: 'none', fontWeight: '500' }}>
                      info@kiscience.com
                    </a>
                  </Text>
                </BlockStack>
                <Button url="mailto:info@kiscience.com">Contact Support</Button>
              </InlineStack>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  )
}

export default WelcomePage
