import React, { useState, useEffect, useCallback } from 'react'
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  Box,
  InlineStack,
  BlockStack,
  Frame,
  Badge,
  EmptyState,
  IndexTable,
  Toast,
  Spinner,
  Banner,
  Modal,
  TextContainer,
  Pagination,
  TextField
} from '@shopify/polaris'
import {
  DeleteIcon,
  ExportIcon,
  RefreshIcon,
  ViewIcon,
  CheckIcon,
  XIcon
} from '@shopify/polaris-icons'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  getFormById,
  getFormSubmissions, 
  deleteSubmission,
  exportSubmissions,
  searchCustomerByEmail,
  createCustomer,
  addTagToCustomer,
  removeTagFromCustomer,
  approveSubmission,
  rejectSubmission as rejectSubmissionApi
} from '../services/formApi'
import NavBar from './NavBar'

const FormSubmissionsPage = ({ shop }) => {
  const navigate = useNavigate()
  const { id: formId } = useParams()

  // State
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  const [deleteModalActive, setDeleteModalActive] = useState(false)
  const [submissionToDelete, setSubmissionToDelete] = useState(null)
  const [viewModalActive, setViewModalActive] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [toastActive, setToastActive] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastError, setToastError] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Approval states
  const [approvalModalActive, setApprovalModalActive] = useState(false)
  const [approvalSubmission, setApprovalSubmission] = useState(null)
  const [approvalCustomer, setApprovalCustomer] = useState(null)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [customerNotFound, setCustomerNotFound] = useState(false)
  const [tagToAdd, setTagToAdd] = useState('practitioner')
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  
  // Reject states
  const [rejectModalActive, setRejectModalActive] = useState(false)
  const [rejectSubmissionData, setRejectSubmissionData] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectAttachment, setRejectAttachment] = useState(null)

  // Approval email attachment (optional file to attach to approval email)
  const [approveAttachment, setApproveAttachment] = useState(null)

  // Fetch form and submissions on mount
  useEffect(() => {
    fetchData()
  }, [formId, pagination.page])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch form details
      const formResponse = await getFormById(formId)
      setForm(formResponse.form)
      
      // Fetch submissions
      const submissionsResponse = await getFormSubmissions(
        formId, 
        pagination.page, 
        pagination.limit
      )
      setSubmissions(submissionsResponse.submissions || [])
      setPagination(prev => ({
        ...prev,
        ...submissionsResponse.pagination
      }))
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message, isError = false) => {
    setToastMessage(message)
    setToastError(isError)
    setToastActive(true)
  }


  const handleDeleteClick = (submission) => {
    setSubmissionToDelete(submission)
    setDeleteModalActive(true)
  }

  const handleDeleteConfirm = async () => {
    if (!submissionToDelete) return

    try {
      setActionLoading(true)

      // If this submission was approved and had a tag added to a Shopify customer, remove only the tag (do not delete the customer)
      let tagRemoved = false
      let tagRemoveError = null
      if (submissionToDelete.shopifyCustomerId && submissionToDelete.tagAdded) {
        try {
          await removeTagFromCustomer(submissionToDelete.shopifyCustomerId, submissionToDelete.tagAdded)
          tagRemoved = true
        } catch (err) {
          tagRemoveError = err.message || 'Could not remove tag from customer'
          // Still delete submission; we'll show the error in the app
        }
      }

      await deleteSubmission(submissionToDelete.id)
      setSubmissions(submissions.filter(s => s.id !== submissionToDelete.id))
      setPagination(prev => ({ ...prev, total: prev.total - 1 }))

      if (tagRemoveError) {
        showToast(`Submission deleted. Tag could not be removed from customer: ${tagRemoveError}`, true)
      } else {
        showToast(
          tagRemoved
            ? 'Submission deleted. Tag removed from customer in store.'
            : 'Submission deleted successfully'
        )
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete submission', true)
    } finally {
      setSubmissionToDelete(null)
      setDeleteModalActive(false)
      setActionLoading(false)
    }
  }


  const handleViewSubmission = (submission) => {
    setSelectedSubmission(submission)
    setViewModalActive(true)
  }

  // Helper to search for a value in submission data by checking multiple possible field names
  // Searches both raw data (with field IDs) and checks against field labels from form
  const findFieldInSubmission = (data, possibleNames) => {
    if (!data) return null
    
    // First, search directly in data keys
    for (const key of possibleNames) {
      if (data[key] && typeof data[key] === 'string') return data[key]
    }
    
    // Then, search through all data entries and check if the key (or its label) matches
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'string' || !value) continue
      
      // Get the label for this key (in case key is a field ID)
      const label = fieldIdToLabel[key] || key
      
      // Check if label matches any of our possible names (case-insensitive)
      const labelLower = label.toLowerCase()
      for (const name of possibleNames) {
        if (labelLower === name.toLowerCase() || labelLower.includes(name.toLowerCase())) {
          return value
        }
      }
    }
    
    return null
  }

  // Find email from submission data
  const findEmailInSubmission = (data) => {
    if (!data) return null
    
    const emailKeys = [
      'email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 
      'email_address', 'emailAddress', 'account email',
      'Your email', 'your email', 'Your account email'
    ]
    
    const result = findFieldInSubmission(data, emailKeys)
    if (result) return result
    
    // Also check by looking at field values that look like emails
    for (const value of Object.values(data)) {
      if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
        return value
      }
    }
    
    return null
  }

  // Find first name from submission data
  const findFirstNameInSubmission = (data) => {
    if (!data) return ''
    
    const firstNameKeys = [
      'firstName', 'first_name', 'firstname', 
      'First Name', 'first name', 'FirstName',
      'Your name', 'your name', 'Your Name',
      'Name', 'name', 'Your first name',
      'Given Name', 'given name', 'givenName'
    ]
    
    return findFieldInSubmission(data, firstNameKeys) || ''
  }

  // Find last name from submission data
  const findLastNameInSubmission = (data) => {
    if (!data) return ''
    
    const lastNameKeys = [
      'lastName', 'last_name', 'lastname',
      'Last Name', 'last name', 'LastName',
      'Surname', 'surname', 
      'Your Surname', 'your surname', 'Your surname',
      'Your last name', 'Your Last Name',
      'Family Name', 'family name', 'familyName'
    ]
    
    return findFieldInSubmission(data, lastNameKeys) || ''
  }

  // Handle approve button click - search for customer first
  const handleApproveClick = async (submission) => {
    setApprovalSubmission(submission)
    setApprovalCustomer(null)
    setCustomerNotFound(false)
    setApprovalLoading(true)
    setApprovalModalActive(true)
    
    const email = findEmailInSubmission(submission.data)
    
    if (!email) {
      setCustomerNotFound(true)
      setApprovalLoading(false)
      return
    }
    
    try {
      const result = await searchCustomerByEmail(email)
      
      if (result.exists && result.customer) {
        setApprovalCustomer(result.customer)
      } else {
        setCustomerNotFound(true)
      }
    } catch (err) {
      console.error('Error searching customer:', err)
      setCustomerNotFound(true)
    } finally {
      setApprovalLoading(false)
    }
  }

  // Create customer and then set for approval
  const handleCreateCustomer = async () => {
    if (!approvalSubmission) return
    
    const email = findEmailInSubmission(approvalSubmission.data)
    const firstName = findFirstNameInSubmission(approvalSubmission.data)
    const lastName = findLastNameInSubmission(approvalSubmission.data)
    
    if (!email) {
      showToast('No email found in submission', true)
      return
    }
    
    try {
      setCreatingCustomer(true)
      
      // Create customer with the tag already
      const result = await createCustomer(email, firstName, lastName, tagToAdd)
      
      if (result.success && result.customer) {
        setApprovalCustomer(result.customer)
        setCustomerNotFound(false)
        showToast('Customer created successfully!')
      }
    } catch (err) {
      showToast(err.message || 'Failed to create customer', true)
    } finally {
      setCreatingCustomer(false)
    }
  }

  // Confirm approval and add tag
  const handleApproveConfirm = async () => {
    if (!approvalSubmission) return
    
    try {
      setApprovalLoading(true)
      
      // If customer found, add the tag
      if (approvalCustomer) {
        await addTagToCustomer(approvalCustomer.id, tagToAdd)
      }
      
      // Update submission status to approved (optional file attached to email)
      await approveSubmission(
        approvalSubmission.id,
        approvalCustomer?.id || null,
        approvalCustomer ? tagToAdd : null,
        approveAttachment || null
      )
      
      // Update local state
      setSubmissions(submissions.map(s => 
        s.id === approvalSubmission.id 
          ? { ...s, approvalStatus: 'approved' }
          : s
      ))
      
      showToast(approvalCustomer 
        ? `Submission approved and "${tagToAdd}" tag added to customer`
        : 'Submission approved'
      )
    } catch (err) {
      showToast(err.message || 'Failed to approve submission', true)
    } finally {
      setApprovalModalActive(false)
      setApprovalSubmission(null)
      setApprovalCustomer(null)
      setApprovalLoading(false)
      setApproveAttachment(null)
    }
  }

  // Handle reject button click
  const handleRejectClick = (submission) => {
    setRejectSubmissionData(submission)
    setRejectReason('')
    setRejectModalActive(true)
  }

  // Confirm rejection
  const handleRejectConfirm = async () => {
    if (!rejectSubmissionData) return
    
    try {
      setActionLoading(true)
      
      await rejectSubmissionApi(rejectSubmissionData.id, rejectReason, rejectAttachment || null)
      
      // Update local state
      setSubmissions(submissions.map(s => 
        s.id === rejectSubmissionData.id 
          ? { ...s, approvalStatus: 'rejected' }
          : s
      ))
      
      showToast('Submission rejected')
    } catch (err) {
      showToast(err.message || 'Failed to reject submission', true)
    } finally {
      setRejectModalActive(false)
      setRejectSubmissionData(null)
      setRejectReason('')
      setRejectAttachment(null)
      setActionLoading(false)
    }
  }

  // Get approval status badge
  const getApprovalBadge = (approvalStatus) => {
    if (!approvalStatus || approvalStatus === 'pending') {
      return <Badge tone="warning">Pending</Badge>
    }
    if (approvalStatus === 'approved') {
      return <Badge tone="success">Approved</Badge>
    }
    if (approvalStatus === 'rejected') {
      return <Badge tone="critical">Rejected</Badge>
    }
    return <Badge tone="warning">Pending</Badge>
  }

  const handleExport = () => {
    const exportUrl = exportSubmissions(formId)
    window.open(exportUrl, '_blank')
  }

  const handlePageChange = (direction) => {
    setPagination(prev => ({
      ...prev,
      page: direction === 'next' ? prev.page + 1 : prev.page - 1
    }))
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).replace(',', '')
  }

  const getStatusBadge = (status) => {
    const statusColors = {
      new: 'attention',
      read: 'info',
      replied: 'success'
    }
    return <Badge tone={statusColors[status] || 'info'}>{status || 'new'}</Badge>
  }

  // Get field labels from form
  const fieldLabels = form?.fields?.map(f => f.label) || []
  
  // Create mapping from field ID to label
  const fieldIdToLabel = {}
  const fieldLabelToId = {}
  form?.fields?.forEach(f => {
    if (f.id && f.label) {
      fieldIdToLabel[f.id] = f.label
      fieldLabelToId[f.label] = f.id
    }
  })

  // Helper function to get display value from submission data
  // Handles both ID-keyed and label-keyed data
  const getFieldValue = (data, label) => {
    if (!data) return null
    // Try label first, then try ID
    const id = fieldLabelToId[label]
    return data[label] || (id ? data[id] : null)
  }

  // Helper function to convert submission data keys from IDs to labels
  const getDisplayData = (data) => {
    if (!data) return {}
    const displayData = {}
    for (const [key, value] of Object.entries(data)) {
      // If key is an ID, convert to label
      const label = fieldIdToLabel[key] || key
      displayData[label] = value
    }
    return displayData
  }

  const rowMarkup = submissions.map((submission, index) => (
    <IndexTable.Row
      id={submission.id}
      key={submission.id}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued">
          {submission.id.slice(-8)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm">
          {formatDate(submission.submittedAt)}
        </Text>
      </IndexTable.Cell>
      {fieldLabels.slice(0, 3).map((label, i) => {
        const value = getFieldValue(submission.data, label);
        const isFile = value && typeof value === 'object' && value.path;
        
        return (
          <IndexTable.Cell key={i}>
            <Text variant="bodySm">
              {isFile ? (value.originalName || 'File uploaded') : (value || '-')}
            </Text>
          </IndexTable.Cell>
        );
      })}
      <IndexTable.Cell>
        {getApprovalBadge(submission.approvalStatus)}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100">
          <Button
            size="slim"
            icon={ViewIcon}
            onClick={() => handleViewSubmission(submission)}
            accessibilityLabel="View submission"
          >
            View
          </Button>
          {(!submission.approvalStatus || submission.approvalStatus === 'pending') && (
            <>
              <Button
                size="slim"
                tone="success"
                onClick={() => handleApproveClick(submission)}
                accessibilityLabel="Approve submission"
              >
                Approve
              </Button>
              <Button
                size="slim"
                tone="critical"
                onClick={() => handleRejectClick(submission)}
                accessibilityLabel="Reject submission"
              >
                Reject
              </Button>
            </>
          )}
          <Button
            size="slim"
            icon={DeleteIcon}
            tone="critical"
            onClick={() => handleDeleteClick(submission)}
            accessibilityLabel="Delete submission"
          />
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ))

  if (loading) {
    return (
      <Frame>
        <NavBar />
        <Page title="Submissions">
          <Layout>
            <Layout.Section>
              <Card>
                <Box padding="800">
                  <InlineStack align="center" blockAlign="center">
                    <Spinner size="large" />
                  </InlineStack>
                </Box>
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </Frame>
    )
  }

  return (
    <Frame>
      <NavBar />
      <Page
        backAction={{ content: 'Forms', onAction: () => navigate('/form-builder') }}
        title={`Submissions: ${form?.name || 'Loading...'}`}
        subtitle={`${pagination.total} total submission(s)`}
        primaryAction={{
          content: 'Export CSV',
          icon: ExportIcon,
          onAction: handleExport,
          disabled: submissions.length === 0
        }}
        secondaryActions={[
          {
            content: 'Refresh',
            icon: RefreshIcon,
            onAction: fetchData,
          }
        ]}
      >
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical" onDismiss={() => setError(null)}>
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card padding="0">
              {submissions.length === 0 ? (
                <Box padding="800">
                  <EmptyState
                    heading="No submissions yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>When customers submit this form, their submissions will appear here.</p>
                  </EmptyState>
                </Box>
              ) : (
                <>
                  <IndexTable
                    resourceName={{ singular: 'submission', plural: 'submissions' }}
                    itemCount={submissions.length}
                    selectable={false}
                    headings={[
                      { title: 'ID' },
                      { title: 'Submitted At' },
                      ...fieldLabels.slice(0, 3).map(label => ({ title: label })),
                      { title: 'Approval' },
                      { title: 'Actions' },
                    ]}
                  >
                    {rowMarkup}
                  </IndexTable>

                  {pagination.totalPages > 1 && (
                    <Box padding="400">
                      <InlineStack align="center" blockAlign="center">
                        <Pagination
                          hasPrevious={pagination.page > 1}
                          hasNext={pagination.page < pagination.totalPages}
                          onPrevious={() => handlePageChange('prev')}
                          onNext={() => handlePageChange('next')}
                        />
                      </InlineStack>
                      <Box paddingBlockStart="200">
                        <InlineStack align="center">
                          <Text as="span" tone="subdued">
                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                          </Text>
                        </InlineStack>
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </Card>
          </Layout.Section>
        </Layout>

        {/* Delete Confirmation Modal */}
        <Modal
        limitHeight
          open={deleteModalActive}
          onClose={() => setDeleteModalActive(false)}
          title="Delete submission"
          primaryAction={{
            content: 'Delete',
            destructive: true,
            onAction: handleDeleteConfirm,
            loading: actionLoading,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setDeleteModalActive(false),
            },
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <p>
                Are you sure you want to delete this submission? This action cannot be undone.
              </p>
            </TextContainer>
          </Modal.Section>
        </Modal>

        {/* View Submission Modal */}
        <Modal
          open={viewModalActive}
          onClose={() => setViewModalActive(false)}
          title="Submission Details"
          limitHeight
          secondaryActions={[
            {
              content: 'Close',
              onAction: () => setViewModalActive(false),
            },
          ]}
        >
          <Modal.Section>
            {selectedSubmission && (
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" fontWeight="semibold">Submission ID</Text>
                  <Text variant="bodyMd">{selectedSubmission.id}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text variant="bodyMd" fontWeight="semibold">Submitted At</Text>
                  <Text variant="bodyMd">
                    {selectedSubmission.submittedAt 
                      ? new Date(selectedSubmission.submittedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }).replace(',', '') // Remove comma for "Jan 19 2026"
                      : '-'
                    }
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text variant="bodyMd" fontWeight="semibold">Approval Status</Text>
                  {getApprovalBadge(selectedSubmission.approvalStatus)}
                </InlineStack>
                
                <Box paddingBlockStart="400">
                  <Text variant="headingMd" as="h3">Form Data</Text>
                </Box>
                
                <Card>
                  <Box padding="400">
                    <BlockStack gap="300">
                      {Object.entries(getDisplayData(selectedSubmission.data) || {}).map(([key, value]) => {
                        // Check if value is a file object
                        const isFile = value && typeof value === 'object' && value.path;
                        const isImage = isFile && value.mimeType && value.mimeType.startsWith('image/');
                        
                        // For images/files, use block layout; for text values, use inline
                        if (isImage) {
                          return (
                            <BlockStack key={key} gap="200">
                              <Text variant="bodyMd" fontWeight="semibold">{key}</Text>
                              <Box>
                                <a 
                                  href={value.path} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ display: 'block' }}
                                >
                                  <img 
                                    src={value.path} 
                                    alt={value.originalName || key}
                                    style={{ 
                                      maxWidth: '100%', 
                                      maxHeight: '200px', 
                                      borderRadius: '4px',
                                      border: '1px solid #ddd'
                                    }}
                                  />
                                </a>
                                <Text variant="bodySm" tone="subdued">
                                  {value.originalName} ({(value.size / 1024).toFixed(1)} KB)
                                  {value.compressed && ` - Compressed from ${(value.originalSize / 1024).toFixed(1)} KB`}
                                </Text>
                              </Box>
                            </BlockStack>
                          );
                        }
                        
                        if (isFile) {
                          return (
                            <InlineStack key={key} align="space-between" blockAlign="center" wrap={false}>
                              <Text variant="bodyMd" fontWeight="semibold">{key}</Text>
                              <Box>
                                <a 
                                  href={value.path} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  {value.originalName || 'Download file'}
                                </a>
                                <Text variant="bodySm" tone="subdued">
                                  ({(value.size / 1024).toFixed(1)} KB)
                                </Text>
                              </Box>
                            </InlineStack>
                          );
                        }
                        
                        return (
                          <InlineStack key={key} align="space-between" blockAlign="start" wrap={false}>
                            <Box minWidth="40%">
                              <Text variant="bodyMd" fontWeight="semibold">{key}</Text>
                            </Box>
                            <Box maxWidth="55%">
                              <Text variant="bodyMd" alignment="end">{String(value) || '-'}</Text>
                            </Box>
                          </InlineStack>
                        );
                      })}
                    </BlockStack>
                  </Box>
                </Card>

                {selectedSubmission.metadata && (
                  <>
                    <Box paddingBlockStart="400">
                      <Text variant="headingMd" as="h3">Metadata</Text>
                    </Box>
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="300">
                          {selectedSubmission.metadata.ip && (
                            <InlineStack align="space-between">
                              <Text variant="bodyMd" fontWeight="semibold">IP Address</Text>
                              <Text variant="bodyMd">{selectedSubmission.metadata.ip}</Text>
                            </InlineStack>
                          )}
                          {selectedSubmission.metadata.userAgent && (
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="semibold">User Agent</Text>
                              <Text variant="bodySm" tone="subdued">
                                {selectedSubmission.metadata.userAgent}
                              </Text>
                            </BlockStack>
                          )}
                        </BlockStack>
                      </Box>
                    </Card>
                  </>
                )}
              </BlockStack>
            )}
          </Modal.Section>
        </Modal>

        {/* Approval Modal */}
        <Modal
        limitHeight
          open={approvalModalActive}
          onClose={() => {
            setApprovalModalActive(false)
            setApprovalSubmission(null)
            setApprovalCustomer(null)
            setCustomerNotFound(false)
            setApproveAttachment(null)
          }}
          title="Approve Submission"
          primaryAction={approvalCustomer ? {
            content: 'Approve & Add Tag',
            onAction: handleApproveConfirm,
            loading: approvalLoading,
          } : (customerNotFound ? {
            content: 'Approve Without Customer',
            onAction: handleApproveConfirm,
            loading: approvalLoading,
          } : null)}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => {
                setApprovalModalActive(false)
                setApprovalSubmission(null)
                setApprovalCustomer(null)
                setCustomerNotFound(false)
                setApproveAttachment(null)
              },
            },
          ]}
        >
          <Modal.Section>
            {approvalLoading ? (
              <Box padding="400">
                <InlineStack align="center" blockAlign="center">
                  <Spinner size="large" />
                  <Text>Searching for customer...</Text>
                </InlineStack>
              </Box>
            ) : approvalCustomer ? (
              <BlockStack gap="400">
                <Banner tone="success">
                  <p>Customer found in your Shopify store!</p>
                </Banner>
                
                <Card>
                  <Box padding="400">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text fontWeight="semibold">Name</Text>
                        <Text>{approvalCustomer.firstName} {approvalCustomer.lastName}</Text>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text fontWeight="semibold">Email</Text>
                        <Text>{approvalCustomer.email}</Text>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text fontWeight="semibold">Current Tags</Text>
                        <Text>{approvalCustomer.tags || 'None'}</Text>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </Card>
                
                <TextField
                  label="Tag to add"
                  value={tagToAdd}
                  onChange={setTagToAdd}
                  helpText="This tag will be added to the customer in Shopify"
                />
                
                <Text tone="subdued">
                  Clicking "Approve & Add Tag" will add the "{tagToAdd}" tag to this customer
                  and mark the submission as approved.
                </Text>
                <BlockStack gap="200">
                  <Text fontWeight="medium">Attach file to approval email (optional)</Text>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={(e) => setApproveAttachment(e.target.files?.[0] || null)}
                  />
                  {approveAttachment && <Text variant="bodySm" tone="subdued">{approveAttachment.name}</Text>}
                </BlockStack>
              </BlockStack>
            ) : customerNotFound ? (
              <BlockStack gap="400">
                <Banner tone="warning">
                  <p>Customer not found in your Shopify store.</p>
                </Banner>
                
                <Text>
                  The email from this submission does not match any existing customer in your store.
                  You can create this customer and add the tag, or approve without creating.
                </Text>
                
                {approvalSubmission && (
                  <Card>
                    <Box padding="400">
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text fontWeight="semibold">Email</Text>
                          <Text>{findEmailInSubmission(approvalSubmission.data) || 'No email found'}</Text>
                        </InlineStack>
                        <InlineStack align="space-between">
                          <Text fontWeight="semibold">First Name</Text>
                          <Text>{findFirstNameInSubmission(approvalSubmission.data) || 'Not provided'}</Text>
                        </InlineStack>
                        <InlineStack align="space-between">
                          <Text fontWeight="semibold">Last Name</Text>
                          <Text>{findLastNameInSubmission(approvalSubmission.data) || 'Not provided'}</Text>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </Card>
                )}
                
                <TextField
                  label="Tag to add"
                  value={tagToAdd}
                  onChange={setTagToAdd}
                  helpText="This tag will be added when creating the customer"
                />
                
                <InlineStack gap="300">
                  <Button
                    variant="primary"
                    onClick={handleCreateCustomer}
                    loading={creatingCustomer}
                  >
                    Create Customer & Add Tag
                  </Button>
                </InlineStack>
                <BlockStack gap="200">
                  <Text fontWeight="medium">Attach file to approval email (optional)</Text>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={(e) => setApproveAttachment(e.target.files?.[0] || null)}
                  />
                  {approveAttachment && <Text variant="bodySm" tone="subdued">{approveAttachment.name}</Text>}
                </BlockStack>
              </BlockStack>
            ) : null}
          </Modal.Section>
        </Modal>

        {/* Reject Modal */}
        <Modal
        limitHeight
          open={rejectModalActive}
          onClose={() => {
            setRejectModalActive(false)
            setRejectSubmissionData(null)
            setRejectReason('')
            setRejectAttachment(null)
          }}
          title="Reject Submission"
          primaryAction={{
            content: 'Reject',
            destructive: true,
            onAction: handleRejectConfirm,
            loading: actionLoading,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => {
                setRejectModalActive(false)
                setRejectSubmissionData(null)
                setRejectReason('')
                setRejectAttachment(null)
              },
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text>Are you sure you want to reject this submission?</Text>
              
              <TextField
                label="Reason (optional)"
                value={rejectReason}
                onChange={setRejectReason}
                multiline={3}
                helpText="Provide a reason for rejection (for internal records)"
              />
              <BlockStack gap="200">
                <Text fontWeight="medium">Attach file to rejection email (optional)</Text>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => setRejectAttachment(e.target.files?.[0] || null)}
                />
                {rejectAttachment && <Text variant="bodySm" tone="subdued">{rejectAttachment.name}</Text>}
              </BlockStack>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Toast */}
        {toastActive && (
          <Toast
            content={toastMessage}
            error={toastError}
            onDismiss={() => setToastActive(false)}
            duration={3000}
          />
        )}
      </Page>
    </Frame>
  )
}

export default FormSubmissionsPage
