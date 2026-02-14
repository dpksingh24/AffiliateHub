import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Frame,
  Page,
  Card,
  BlockStack,
  InlineStack,
  InlineGrid,
  Badge,
  Text,
  Box,
  Divider,
  Spinner,
  Banner,
  DataTable,
} from '@shopify/polaris';
import NavBar from './NavBar';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount));
}

function getStatusBadgeTone(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'success';
  if (s === 'pending') return 'attention';
  if (s === 'suspended' || s === 'deactivated') return 'critical';
  return 'info';
}

function AffiliateDetailPage({ shop }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [affiliate, setAffiliate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id || !shop) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ shop });
    fetch(`/api/admin/affiliates/${id}?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.affiliate) {
          setAffiliate(data.affiliate);
        } else {
          setError(data.error || 'Affiliate not found');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load affiliate');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, shop]);

  const handleBack = () => {
    const shopParam = shop ? `?shop=${encodeURIComponent(shop)}` : '';
    navigate(`/affiliates${shopParam}`);
  };

  if (loading) {
    return (
      <Frame>
        <NavBar />
        <Page title="Affiliate details" backAction={{ content: 'Affiliates', onAction: handleBack }}>
          <Card>
            <Box padding="800">
              <InlineStack align="center" blockAlign="center" gap="400">
                <Spinner size="large" />
                <Text as="span">Loading…</Text>
              </InlineStack>
            </Box>
          </Card>
        </Page>
      </Frame>
    );
  }

  if (error || !affiliate) {
    return (
      <Frame>
        <NavBar />
        <Page title="Affiliate details" backAction={{ content: 'Affiliates', onAction: handleBack }}>
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error || 'Affiliate not found'}
          </Banner>
        </Page>
      </Frame>
    );
  }

  const referralRows = (affiliate.referralLinks || []).map((link) => [
    link.description || '—',
    link.shortCode || '—',
    link.url ? (
      <span key={link.shortCode} style={{ color: '#2B7BE5', fontSize: '13px', cursor: 'not-allowed', opacity: 0.7 }}>
        {link.url.length > 48 ? link.url.slice(0, 48) + '…' : link.url}
      </span>
    ) : '—',
    String(link.clicks ?? 0),
    String(link.conversions ?? 0),
    formatCurrency(link.revenue, affiliate.currency)
  ]);

  return (
    <Frame>
      <NavBar />
      <Page
        title={affiliate.fullName || 'Affiliate details'}
        backAction={{ content: 'Affiliates', onAction: handleBack }}
        subtitle={affiliate.email}
      >
        <BlockStack gap={{ xs: '800', sm: '400' }}>
          {/* Summary / Key metrics */}
          <InlineGrid columns={{ xs: '1fr', md: '2fr 5fr' }} gap="400">
            <Box as="section" paddingInlineStart={{ xs: 400, sm: 0 }} paddingInlineEnd={{ xs: 400, sm: 0 }}>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Summary
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Key earnings and activity metrics for this affiliate.
                </Text>
              </BlockStack>
            </Box>
            <Card roundedAbove="sm">
              <Box padding="400">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Paid earnings</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">{formatCurrency(affiliate.earningsPaid, affiliate.currency)}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Unpaid (pending)</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">{formatCurrency(affiliate.earningsPending, affiliate.currency)}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Visits</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">{affiliate.visitsCount ?? 0}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Conversions</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">{affiliate.totalConversions ?? 0}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Paid referrals</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">{affiliate.paidReferralCount ?? 0}</Text>
                  </BlockStack>
                </div>
              </Box>
            </Card>
          </InlineGrid>

          <Divider />

          {/* Profile */}
          <InlineGrid columns={{ xs: '1fr', md: '2fr 5fr' }} gap="400">
            <Box as="section" paddingInlineStart={{ xs: 400, sm: 0 }} paddingInlineEnd={{ xs: 400, sm: 0 }}>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Profile
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Contact and account details for this affiliate.
                </Text>
              </BlockStack>
            </Box>
            <Card roundedAbove="sm">
              <Box padding="400">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Affiliate ID</Text>
                    <Text as="span" variant="bodyMd" tone="subdued">{affiliate.id || '—'}</Text>
                  </InlineStack>
                  <InlineStack align="space-between" blockAlign="center" gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Full name</Text>
                    <Text as="span" variant="bodyMd">{affiliate.fullName || '—'}</Text>
                  </InlineStack>
                  <InlineStack align="space-between" blockAlign="center" gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Email</Text>
                    <Text as="span" variant="bodyMd" breakWord>{affiliate.email || '—'}</Text>
                  </InlineStack>
                  <InlineStack align="space-between" blockAlign="center" gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Status</Text>
                    <Badge tone={getStatusBadgeTone(affiliate.status)}>{affiliate.status || 'pending'}</Badge>
                  </InlineStack>
                  {affiliate.createdAt && (
                    <InlineStack align="space-between" blockAlign="center" gap="200">
                      <Text as="span" variant="bodySm" tone="subdued">Joined</Text>
                      <Text as="span" variant="bodyMd">{formatDate(affiliate.createdAt)}</Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </Box>
            </Card>
          </InlineGrid>

          <Divider />

          {/* Referral links */}
          <InlineGrid columns={{ xs: '1fr', md: '2fr 5fr' }} gap="400">
            <Box as="section" paddingInlineStart={{ xs: 400, sm: 0 }} paddingInlineEnd={{ xs: 400, sm: 0 }}>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Referral links
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Links and short codes used by this affiliate. Clicks, conversions, and revenue per link.
                </Text>
              </BlockStack>
            </Box>
            <Card roundedAbove="sm">
              <Box padding="400">
                {referralRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'numeric']}
                    headings={['Description', 'Code', 'URL', 'Clicks', 'Conversions', 'Revenue']}
                    rows={referralRows}
                  />
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">No referral links.</Text>
                )}
              </Box>
            </Card>
          </InlineGrid>
        </BlockStack>
      </Page>
    </Frame>
  );
}

export default AffiliateDetailPage;
