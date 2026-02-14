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
import { getForms, getAffiliateForms } from '../services/formApi'
import { getPricingRules } from '../services/pricingApi'

const WelcomePage = ({ shop }) => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [formsData, setFormsData] = useState({ total: 0, active: 0, submissions: 0, recentForms: [] })
  const [pricingData, setPricingData] = useState({ total: 0, active: 0, recentRules: [] })
  const [affiliateData, setAffiliateData] = useState({ total: 0, active: 0, submissions: 0, recentForms: [] })
  const [referralData, setReferralData] = useState({
    referralsTotal: 0,
    affiliatesTotal: 0,
    visitsTotal: 0,
    recentReferrals: []
  })

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

      try {
        const affiliateResponse = await getAffiliateForms()
        const affiliateForms = affiliateResponse.forms || affiliateResponse || []
        const affiliateList = Array.isArray(affiliateForms) ? affiliateForms : []
        const activeAffiliate = affiliateList.filter(f => f.status === 'Active')
        const totalAffiliateSubmissions = affiliateList.reduce((acc, f) => acc + (f.totalSubmissions || 0), 0)
        setAffiliateData({
          total: affiliateList.length,
          active: activeAffiliate.length,
          submissions: totalAffiliateSubmissions,
          recentForms: affiliateList.slice(0, 3)
        })
      } catch (err) {
        console.error('Error fetching affiliate forms:', err)
      }

      try {
        const pricingResponse = await getPricingRules()
        const rules = pricingResponse.rules || []
        const activeRules = rules.filter(r => r.status === 'active')
        setPricingData({
          total: rules.length,
          active: activeRules.length,
          recentRules: rules.slice(0, 3)
        })
      } catch (err) {
        console.error('Error fetching pricing rules:', err)
      }

      if (shop) {
        try {
          const base = `${window.location.origin}/api/admin`
          const shopParam = `shop=${encodeURIComponent(shop)}`
          const [refRes, affRes, visRes] = await Promise.all([
            fetch(`${base}/referrals?${shopParam}&page=1&limit=3`).then(r => r.json()),
            fetch(`${base}/affiliates?${shopParam}&page=1&limit=1`).then(r => r.json()),
            fetch(`${base}/visits?${shopParam}&page=1&limit=1`).then(r => r.json())
          ])
          setReferralData({
            referralsTotal: refRes.success ? (refRes.total ?? 0) : 0,
            affiliatesTotal: affRes.success ? (affRes.total ?? 0) : 0,
            visitsTotal: visRes.success ? (visRes.total ?? 0) : 0,
            recentReferrals: refRes.success && Array.isArray(refRes.referrals) ? refRes.referrals.slice(0, 3) : []
          })
        } catch (err) {
          console.error('Error fetching referral area data:', err)
        }
      }

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
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '16px',
                    marginTop: '30px'
                  }}>
                    {[
                      { label: 'Total Forms', value: formsData.total, icon: NoteIcon },
                      { label: 'Active Forms', value: formsData.active, icon: CheckCircleIcon },
                      { label: 'Submissions', value: formsData.submissions, icon: PersonFilledIcon },
                      { label: 'Pricing Rules', value: pricingData.total, icon: DiscountFilledIcon },
                      { label: 'Affiliate Forms', value: affiliateData.total, icon: PersonFilledIcon },
                      { label: 'Referrals', value: referralData.referralsTotal, icon: ChartVerticalFilledIcon }
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px'
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
                                {rule.priceType === 'amount_off'
                                  ? `$${rule.discountValue} off`
                                  : rule.priceType === 'new_price'
                                    ? `$${rule.discountValue} fixed`
                                    : `${rule.discountValue}% off`}
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
                            {rule.priceType === 'amount_off'
                              ? `-$${rule.discountValue}`
                              : rule.priceType === 'new_price'
                                ? `$${rule.discountValue}`
                                : `-${rule.discountValue}%`}
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

              {/* Affiliate Form Card */}
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
              onClick={() => navigate('/affiliate-form')}
              >
                {/* Card Header */}
                <div style={{
                  background: 'linear-gradient(135deg, rgb(93,93,93) 0%, rgb(68,141,154) 100%)',
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
                        <Icon source={PersonFilledIcon} />
                      </div>
                      <BlockStack gap="100">
                        <Text variant="headingLg" as="h2" fontWeight="bold">
                          <span style={{ color: 'white' }}>Affiliate Form</span>
                        </Text>
                        <Text variant="bodySm">
                          <span style={{ color: 'rgba(255,255,255,0.8)' }}>Manage affiliate applications</span>
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
                  ) : affiliateData.recentForms.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        background: '#f5f3ff',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                      }}>
                        <Icon source={PersonFilledIcon} tone="info" />
                      </div>
                      <Text variant="bodyMd" tone="subdued">No affiliate forms yet</Text>
                      <div style={{ marginTop: '16px' }}>
                        <Button
                          variant="primary"
                          icon={PlusIcon}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('/affiliate-form')
                          }}
                        >
                          Create Affiliate Form
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <BlockStack gap="300">
                      <Text variant="bodySm" tone="subdued" fontWeight="semibold">RECENT AFFILIATE FORMS</Text>
                      {affiliateData.recentForms.map((form) => (
                        <div
                          key={form._id || form.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '14px 16px',
                            background: '#f8fafc',
                            borderRadius: '10px',
                            borderLeft: `4px solid ${form.status === 'Active' ? '#8b5cf6' : '#94a3b8'}`
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/affiliate-form/${form._id || form.id}/submissions`)
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
                          navigate('/affiliate-form')
                        }}
                      >
                        Create Affiliate Form
                      </Button>
                    </BlockStack>
                  )}
                </div>
              </div>
            </div>
                          {/* Referral Area Card */}
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
              onClick={() => navigate('/referrals' + (shop ? `?shop=${encodeURIComponent(shop)}` : ''))}
              >
                <div style={{
                  background: 'linear-gradient(135deg, #0f3460 0%, #16213e 50%, #1a1a2e 100%)',
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
                        <Icon source={ChartVerticalFilledIcon} />
                      </div>
                      <BlockStack gap="100">
                        <Text variant="headingLg" as="h2" fontWeight="bold">
                          <span style={{ color: 'white' }}>Referral Area</span>
                        </Text>
                        <Text variant="bodySm">
                          <span style={{ color: 'rgba(255,255,255,0.8)' }}>Affiliates, visits & conversions</span>
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

                <div style={{ padding: '20px' }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Spinner size="small" />
                    </div>
                  ) : (
                    <BlockStack gap="300">
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px'
                      }}>
                        <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f3460' }}>{referralData.referralsTotal}</div>
                          <Text variant="bodySm" tone="subdued">Referrals</Text>
                        </div>
                        <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f3460' }}>{referralData.affiliatesTotal}</div>
                          <Text variant="bodySm" tone="subdued">Affiliates</Text>
                        </div>
                        <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f3460' }}>{referralData.visitsTotal}</div>
                          <Text variant="bodySm" tone="subdued">Visits</Text>
                        </div>
                      </div>
                      <Text variant="bodySm" tone="subdued" fontWeight="semibold">RECENT REFERRALS</Text>
                      {referralData.recentReferrals.length === 0 ? (
                        <Text variant="bodyMd" tone="subdued">No referrals yet</Text>
                      ) : (
                        referralData.recentReferrals.map((ref) => (
                          <div
                            key={ref.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '14px 16px',
                              background: '#f8fafc',
                              borderRadius: '10px',
                              borderLeft: `4px solid ${ref.status === 'Paid' ? '#22c55e' : ref.status === 'Rejected' ? '#ef4444' : '#f59e0b'}`
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/referrals/${ref.id}` + (shop ? `?shop=${encodeURIComponent(shop)}` : ''))
                            }}
                          >
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="semibold">{ref.reference || ref.referralId || '—'}</Text>
                              <InlineStack gap="200">
                                <Text variant="bodySm" tone="subdued">{ref.affiliateName || '—'}</Text>
                                <Badge tone={ref.status === 'Paid' ? 'success' : ref.status === 'Rejected' ? 'critical' : 'attention'} size="small">
                                  {ref.status || 'Unpaid'}
                                </Badge>
                              </InlineStack>
                            </BlockStack>
                            <Text variant="bodyMd" fontWeight="semibold">
                              {ref.currency === 'GBP' ? '£' : ref.currency === 'EUR' ? '€' : '$'}{Number(ref.amount || 0).toFixed(2)}
                            </Text>
                          </div>
                        ))
                      )}
                      <Button
                        variant="primary"
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('/referrals' + (shop ? `?shop=${encodeURIComponent(shop)}` : ''))
                        }}
                      >
                        View Referral Area
                      </Button>
                    </BlockStack>
                  )}
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
