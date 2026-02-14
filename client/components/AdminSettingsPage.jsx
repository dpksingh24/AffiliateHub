import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Frame,
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Spinner,
  TextField,
  Select,
  Box,
  InlineStack,
  BlockStack,
} from '@shopify/polaris';
import NavBar from './NavBar';
import styles from './AdminSettingsPage.module.css';

const EMAIL_TEMPLATE_OPTIONS = [
  { label: 'Form submission received', value: 'submission_received' },
  { label: 'Application approved', value: 'approval' },
  { label: 'Application rejected', value: 'rejection' },
  { label: 'Affiliate registration received', value: 'affiliate_registration' },
  { label: 'Affiliate application approved', value: 'affiliate_approval' },
  { label: 'Affiliate application rejected', value: 'affiliate_rejection' },
];

/**
 * Admin Settings Page
 * Edit email templates and affiliate area greeting
 */
function AdminSettingsPage({ shop }) {
  const navigate = useNavigate();
  const [emailTemplates, setEmailTemplates] = useState(null);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('submission_received');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaveMessage, setTemplateSaveMessage] = useState('');

  const [affiliateGreeting, setAffiliateGreeting] = useState('');
  const [affiliateGreetingLoading, setAffiliateGreetingLoading] = useState(false);
  const [affiliateGreetingSaving, setAffiliateGreetingSaving] = useState(false);
  const [affiliateGreetingMessage, setAffiliateGreetingMessage] = useState('');

  const [commissionPercent, setCommissionPercent] = useState('10');
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionSaving, setCommissionSaving] = useState(false);
  const [commissionMessage, setCommissionMessage] = useState('');

  useEffect(() => {
    if (shop) {
      fetchEmailTemplates();
      fetchAffiliateGreeting();
      fetchAffiliateCommissionRate();
    }
  }, [shop]);

  const fetchEmailTemplates = async () => {
    if (!shop) return;
    try {
      setEmailTemplatesLoading(true);
      const response = await fetch(`/api/admin/email-templates?shop=${encodeURIComponent(shop)}`);
      const data = await response.json();
      if (data.success && data.templates) {
        setEmailTemplates(data.templates);
        const t = data.templates[selectedTemplateKey];
        if (t) {
          setTemplateSubject(t.subject || '');
          setTemplateText(t.text || '');
        }
      }
    } catch (error) {
      console.error('Failed to fetch email templates:', error);
    } finally {
      setEmailTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (emailTemplates && selectedTemplateKey && emailTemplates[selectedTemplateKey]) {
      const t = emailTemplates[selectedTemplateKey];
      setTemplateSubject(t.subject || '');
      setTemplateText(t.text || '');
    }
  }, [selectedTemplateKey, emailTemplates]);

  const fetchAffiliateGreeting = async () => {
    if (!shop) return;
    try {
      setAffiliateGreetingLoading(true);
      const response = await fetch(`/api/admin/affiliate-area-greeting?shop=${encodeURIComponent(shop)}`);
      const data = await response.json();
      if (data.success && data.message != null) {
        setAffiliateGreeting(data.message);
      }
    } catch (error) {
      console.error('Failed to fetch affiliate area greeting:', error);
    } finally {
      setAffiliateGreetingLoading(false);
    }
  };

  const fetchAffiliateCommissionRate = async () => {
    if (!shop) return;
    try {
      setCommissionLoading(true);
      const response = await fetch(`/api/admin/affiliate-commission-rate?shop=${encodeURIComponent(shop)}`);
      const data = await response.json();
      if (data.success && data.commissionRate != null) {
        const percent = Math.round(Number(data.commissionRate) * 100);
        setCommissionPercent(String(percent));
      }
    } catch (error) {
      console.error('Failed to fetch affiliate commission rate:', error);
    } finally {
      setCommissionLoading(false);
    }
  };

  const handleSaveAffiliateCommissionRate = async () => {
    if (!shop) return;
    const num = parseFloat(commissionPercent);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setCommissionMessage('Enter a number between 0 and 100');
      setTimeout(() => setCommissionMessage(''), 4000);
      return;
    }
    try {
      setCommissionSaving(true);
      setCommissionMessage('');
      const response = await fetch('/api/admin/affiliate-commission-rate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, commissionRate: num / 100 }),
      });
      const data = await response.json();
      if (data.success) {
        setCommissionMessage(`Affiliate commission set to ${num}%. New referrals will use this rate.`);
        setTimeout(() => setCommissionMessage(''), 4000);
      } else {
        setCommissionMessage(data.error || 'Failed to save');
      }
    } catch (error) {
      setCommissionMessage('Error: ' + error.message);
    } finally {
      setCommissionSaving(false);
    }
  };

  const handleSaveAffiliateGreeting = async () => {
    if (!shop) return;
    try {
      setAffiliateGreetingSaving(true);
      setAffiliateGreetingMessage('');
      const response = await fetch('/api/admin/affiliate-area-greeting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, message: affiliateGreeting }),
      });
      const data = await response.json();
      if (data.success) {
        setAffiliateGreetingMessage('Affiliate area greeting saved. It will appear on the Affiliate Area page.');
        setTimeout(() => setAffiliateGreetingMessage(''), 4000);
      } else {
        setAffiliateGreetingMessage(data.error || 'Failed to save');
      }
    } catch (error) {
      setAffiliateGreetingMessage('Error: ' + error.message);
    } finally {
      setAffiliateGreetingSaving(false);
    }
  };

  const handleSaveEmailTemplate = async () => {
    if (!shop || !selectedTemplateKey) return;
    try {
      setTemplateSaving(true);
      setTemplateSaveMessage('');
      const response = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop,
          templates: {
            [selectedTemplateKey]: {
              subject: templateSubject,
              text: templateText,
            },
          },
        }),
      });
      const data = await response.json();
      if (data.success) {
        setEmailTemplates(data.templates || emailTemplates);
        setTemplateSaveMessage('Template saved. Emails will use this content.');
        setTimeout(() => setTemplateSaveMessage(''), 4000);
      } else {
        setTemplateSaveMessage(data.error || 'Failed to save');
      }
    } catch (error) {
      setTemplateSaveMessage('Error: ' + error.message);
    } finally {
      setTemplateSaving(false);
    }
  };

  return (
    <Frame>
      <NavBar />
      <Page
        backAction={{ content: 'Back', onAction: () => navigate(-1) }}
        title="Admin Settings"
        subtitle="Email templates and affiliate area"
      >
        <Layout>
          <Layout.Section>
            <Card>
              <div className={styles.commissionCardHeader}>
                <h2 className={styles.commissionCardTitle}>Affiliate commission rate</h2>
              </div>
              <div className={styles.commissionSection}>
                {commissionMessage && (
                  <Box paddingBlockEnd="400">
                    <Banner tone={commissionMessage.startsWith('Affiliate') ? 'success' : 'critical'} onDismiss={() => setCommissionMessage('')}>
                      {commissionMessage}
                    </Banner>
                  </Box>
                )}
                {commissionLoading ? (
                  <InlineStack align="center" blockAlign="center" gap="400">
                    <Spinner size="small" />
                    <span>Loading...</span>
                  </InlineStack>
                ) : (
                  <BlockStack gap="400">
                    <p className={styles.commissionSectionLabel}>Commission rate</p>
                    <div className={styles.commissionFieldGroup}>
                      <TextField
                        label="Commission (%)"
                        type="number"
                        value={commissionPercent}
                        onChange={setCommissionPercent}
                        min={0}
                        max={100}
                        step={0.5}
                        autoComplete="off"
                        helpText="Commission percentage paid to affiliates on each sale made through their referral link. Applies to all affiliates unless you set a custom rate per affiliate. e.g. 10 for 10%; use 0.5 steps for 7.5%."
                        suffix="%"
                      />
                    </div>
                    <Button primary loading={commissionSaving} onClick={handleSaveAffiliateCommissionRate}>
                      Save commission rate
                    </Button>
                  </BlockStack>
                )}
              </div>
            </Card>
            <Box paddingBlockStart="400" />

            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <h2 className={styles.sectionHeading}>Affiliate area greeting</h2>
                  <p className={styles.description}>
                    This message is shown at the top of the Affiliate Area page (e.g. payment dates, PayPal reminder). Line breaks are preserved.
                  </p>
                  {affiliateGreetingMessage && (
                    <Banner tone="success" onDismiss={() => setAffiliateGreetingMessage('')}>
                      {affiliateGreetingMessage}
                    </Banner>
                  )}
                  {affiliateGreetingLoading ? (
                    <InlineStack align="center" blockAlign="center" gap="400">
                      <Spinner size="small" />
                      <span>Loading...</span>
                    </InlineStack>
                  ) : (
                    <>
                      <TextField
                        label="Greeting message"
                        value={affiliateGreeting}
                        onChange={setAffiliateGreeting}
                        multiline={6}
                        autoComplete="off"
                        helpText="Shown to affiliates when they open the Affiliate Area. You can update payment dates and instructions here."
                      />
                      <Button primary loading={affiliateGreetingSaving} onClick={handleSaveAffiliateGreeting}>
                        Save greeting message
                      </Button>
                    </>
                  )}
                </BlockStack>
              </Box>
            </Card>

            <Box paddingBlockStart="400" />
            <Card>
              <Box padding="400">
                <h2 className={styles.sectionHeading}>Email templates</h2>
                <p className={styles.description}>
                  Edit the subject and message below. Emails are sent in a clean format based on your text—no coding needed. 
                  You can use placeholders: <span className={styles.code}>{'{{name}}'}</span>, <span className={styles.code}>{'{{formName}}'}</span>, <span className={styles.code}>{'{{reason}}'}</span>, <span className={styles.code}>{'{{dashboardUrl}}'}</span> (affiliate approval only).
                </p>
                {templateSaveMessage && (
                  <Box paddingBlockEnd="400">
                    <Banner tone="success" onDismiss={() => setTemplateSaveMessage('')}>
                      {templateSaveMessage}
                    </Banner>
                  </Box>
                )}
                {emailTemplatesLoading ? (
                  <Box padding="800">
                    <InlineStack align="center" blockAlign="center" gap="400">
                      <Spinner />
                      <span>Loading templates...</span>
                    </InlineStack>
                  </Box>
                ) : emailTemplates ? (
                  <BlockStack gap="400">
                    <Select
                      label="Template"
                      options={EMAIL_TEMPLATE_OPTIONS}
                      value={selectedTemplateKey}
                      onChange={setSelectedTemplateKey}
                    />
                    <TextField
                      label="Subject"
                      value={templateSubject}
                      onChange={setTemplateSubject}
                      autoComplete="off"
                    />
                    <TextField
                      label="Message"
                      value={templateText}
                      onChange={setTemplateText}
                      multiline={10}
                      autoComplete="off"
                      helpText="Plain text message. Line breaks are kept in the email."
                    />
                    <Button primary loading={templateSaving} onClick={handleSaveEmailTemplate}>
                      Save this template
                    </Button>
                  </BlockStack>
                ) : null}
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}

export default AdminSettingsPage;
