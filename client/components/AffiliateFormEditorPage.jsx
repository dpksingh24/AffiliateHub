import React, { useState, useEffect } from 'react'
import {
Page,
Layout,
Card,
Button,
Text,
TextField,
Select,
FormLayout,
Box,
InlineStack,
BlockStack,
Divider,
Frame,
Badge,
Icon,
EmptyState,
Toast,
Spinner,
Banner,
Checkbox,
Modal,
TextContainer
} from '@shopify/polaris'
import {
  PlusIcon,
  DeleteIcon,
  DragHandleIcon,
  EditIcon
} from '@shopify/polaris-icons'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  getAffiliateFormById,
  createAffiliateForm,
  updateAffiliateForm
} from '../services/formApi'
import NavBar from './NavBar'

const AffiliateFormEditorPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const isEditing = !!id && id !== 'new'

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formFields, setFormFields] = useState([])
  const [formStatus, setFormStatus] = useState('Draft')

  const [hasChanges, setHasChanges] = useState(false)

  const [toastActive, setToastActive] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastError, setToastError] = useState(false)
  const [discardModalActive, setDiscardModalActive] = useState(false)
  const [previewModalActive, setPreviewModalActive] = useState(false)

  const [newFieldType, setNewFieldType] = useState('text')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldColumns, setNewFieldColumns] = useState('1')

  // Edit field modal state
  const [editModalActive, setEditModalActive] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [editFieldLabel, setEditFieldLabel] = useState('')
  const [editFieldType, setEditFieldType] = useState('text')
  const [editFieldPlaceholder, setEditFieldPlaceholder] = useState('')
  const [editFieldColumns, setEditFieldColumns] = useState('1')
  const [editFieldRequired, setEditFieldRequired] = useState(false)

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const fieldTypeOptions = [
    { label: 'Text', value: 'text' },
    { label: 'Email', value: 'email' },
    { label: 'Phone', value: 'phone' },
    { label: 'Number', value: 'number' },
    { label: 'Textarea', value: 'textarea' },
    { label: 'Select', value: 'select' },
    { label: 'Checkbox', value: 'checkbox' },
    { label: 'Date', value: 'date' },
  ]

  const columnOptions = [
    { label: '1 Column (1/3 width)', value: '1' },
    { label: '2 Columns (2/3 width)', value: '2' },
    { label: '3 Columns (Full width)', value: '3' },
  ]

  const handleAddField = () => {
    if (!newFieldLabel.trim()) {
      showToast('Field label is required', true)
      return
    }
  
    const newField = {
      id: Date.now().toString(),
      type: newFieldType,
      label: newFieldLabel.trim(),
      required: newFieldType !== 'checkbox' ? newFieldRequired : false,
      placeholder: newFieldPlaceholder.trim() || undefined
    }
  
    setFormFields(prev => [...prev, newField])
  
    // reset
    setNewFieldLabel('')
    setNewFieldRequired(false)
    setNewFieldType('text')
    setNewFieldPlaceholder('')
    setHasChanges(true)
  }

  useEffect(() => {
    if (isEditing) fetchForm()
  }, [id])

  // Apply template when creating new form from template picker
  useEffect(() => {
    if (!isEditing && location.state?.template) {
      const t = location.state.template
      setFormName(t.name || '')
      setFormDescription(t.description || 'Application form for affiliates. You can edit this later.')
      setFormStatus(t.status || 'Draft')
      const fields = (t.fields || []).map((f, i) => ({
        id: f.id || `field-${i}-${Date.now()}`,
        type: f.type || 'text',
        label: f.label || '',
        name: f.name,
        required: !!f.required,
        placeholder: f.placeholder || undefined
      }))
      setFormFields(fields)
    }
  }, [])

  const fetchForm = async () => {
    try {
      setLoading(true)
      const { form } = await getAffiliateFormById(id)
      setFormName(form.name)
      setFormDescription(form.description || '')
      setFormFields(form.fields || [])
      setFormStatus(form.status || 'Draft')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, isError = false) => {
    setToastMessage(msg)
    setToastError(isError)
    setToastActive(true)
  }

  const handleSave = async (publish = false) => {
    if (!formName.trim()) {
      showToast('Form name is required', true)
      return
    }

    if (!formDescription.trim()) {
      showToast('Form description is required', true)
      return
    }

    try {
      setSaving(true)

      const payload = {
        name: formName.trim(),
        description: formDescription.trim(),
        fields: formFields,
        status: publish ? 'Active' : formStatus
      }

      if (isEditing) {
        await updateAffiliateForm(id, payload)
        showToast('Form updated successfully')
      } else {
        await createAffiliateForm(payload)
        showToast('Form created successfully')
      }

      setHasChanges(false)
      setTimeout(() => navigate('/affiliate-form'), 1500)
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (hasChanges) setDiscardModalActive(true)
    else navigate('/affiliate-form')
  }

  // Drag and drop handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null) return
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newFields = [...formFields]
    const [draggedField] = newFields.splice(draggedIndex, 1)
    newFields.splice(dropIndex, 0, draggedField)

    setFormFields(newFields)
    setDraggedIndex(null)
    setDragOverIndex(null)
    setHasChanges(true)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Edit field handlers
  const handleEditField = (field) => {
    setEditingField(field)
    setEditFieldLabel(field.label)
    setEditFieldType(field.type)
    setEditFieldPlaceholder(field.placeholder || '')
    setEditFieldRequired(field.required || false)
    setEditFieldColumns(String(field.columns || 1))
    setEditModalActive(true)
  }

  const handleSaveEditField = () => {
    if (!editFieldLabel.trim()) {
      showToast('Field label is required', true)
      return
    }

    setFormFields(prev => prev.map(f => 
      f.id === editingField.id 
        ? {
            ...f,
            label: editFieldLabel.trim(),
            type: editFieldType,
            placeholder: editFieldPlaceholder.trim() || undefined,
            columns: parseInt(editFieldColumns),
            required: editFieldType !== 'checkbox' ? editFieldRequired : false
          }
        : f
    ))

    setEditModalActive(false)
    setEditingField(null)
    setEditFieldColumns('1')
    setHasChanges(true)
    showToast('Field updated successfully')
  }

  const handleRemoveField = (id) => {
    setFormFields(prev => prev.filter(f => f.id !== id))
    setHasChanges(true)
  }

  if (loading) {
    return (
      <Frame>
        <NavBar />
        <Page title={isEditing ? 'Edit Form' : 'Create New Form'}>
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
      <div style={{ paddingBottom: '80px' }}> {/* Add padding for sticky footer */}
        <Page
            backAction={{ content: 'Affiliate Forms', onAction: handleBack }}
            title={isEditing ? 'Edit Affiliate Form' : 'Create Affiliate Form'}
            subtitle="Design your affiliate registration form"
        >
            <Layout>

            {error && (
                <Layout.Section>
                <Banner tone="critical" onDismiss={() => setError(null)}>
                    {error}
                </Banner>
                </Layout.Section>
            )}

            {/* FORM NAME */}
            <Layout.Section>
                <Card>
                <Box padding="400">
                    <FormLayout>
                    <TextField
                        label="Form Name"
                        value={formName}
                        onChange={(v) => {
                        setFormName(v)
                        setHasChanges(true)
                        }}
                        placeholder="Enter form name"
                        requiredIndicator
                    />
                    <TextField
                        label="Form Description"
                        value={formDescription}
                        onChange={(v) => {
                        setFormDescription(v)
                        setHasChanges(true)
                        }}
                        placeholder="Enter form description"
                        autoComplete="off"
                    />
                    <Select
                        label="Form Status"
                        options={[
                        { label: 'Draft', value: 'Draft' },
                        { label: 'Active', value: 'Active' },
                        { label: 'Inactive', value: 'Inactive' },
                        ]}
                        value={formStatus}
                        onChange={(v) => {
                        setFormStatus(v)
                        setHasChanges(true)
                        }}
                    />
                    </FormLayout>
                </Box>
                </Card>
            </Layout.Section>

            {/* FORM FIELDS */}
            <Layout.Section>
                <Card>
                <Box padding="400">
                    <BlockStack gap="400">
                    <InlineStack align="space-between">
                        <Text variant="headingMd" as="h2">
                        Form Fields
                        </Text>
                        <Badge tone="info">{formFields.length} fields</Badge>
                    </InlineStack>

                    <Divider />

                    {formFields.length === 0 ? (
                        <EmptyState
                        heading="No fields added yet"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                        >
                        <p>Add your first form field using the panel on the right.</p>
                        </EmptyState>
                    ) : (
                        <BlockStack gap="200">
                        {formFields.map((field, index) => (
                            <div
                            key={field.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            style={{
                                cursor: 'grab',
                                transition: 'all 0.2s ease',
                                borderTop:
                                dragOverIndex === index && draggedIndex !== null && draggedIndex > index
                                    ? '3px solid #7db9b3'
                                    : undefined,
                                borderBottom:
                                dragOverIndex === index && draggedIndex !== null && draggedIndex < index
                                    ? '3px solid #7db9b3'
                                    : undefined,
                            }}
                            >
                            <div
                                style={{
                                background: '#fff',
                                border: '1px solid #e1e3e5',
                                borderRadius: '8px',
                                borderLeft: `4px solid ${
                                    field.required ? '#e53935' : '#7db9b3'
                                }`,
                                }}
                            >
                                <div style={{ padding: '12px 16px' }}>
                                {/* Top row */}
                                <div
                                    style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '6px',
                                    }}
                                >
                                    <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}
                                    >
                                    <Icon source={DragHandleIcon} tone="subdued" />

                                    <Text variant="bodyMd" fontWeight="semibold">
                                        {field.label}
                                    </Text>

                                    {field.required && (
                                        <span
                                        style={{
                                            color: '#e53935',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                        }}
                                        >
                                        Required
                                        </span>
                                    )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px' }}>
                                    <Button
                                        size="slim"
                                        icon={EditIcon}
                                        onClick={() => handleEditField(field)}
                                    />
                                    <Button
                                        size="slim"
                                        icon={DeleteIcon}
                                        tone="critical"
                                        onClick={() => handleRemoveField(field.id)}
                                    />
                                    </div>
                                </div>

                                {/* Meta row */}
                                <div
                                    style={{
                                    display: 'flex',
                                    gap: '10px',
                                    marginLeft: '28px',
                                    flexWrap: 'wrap',
                                    }}
                                >
                                    <span
                                    style={{
                                        background: '#f4f6f8',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        textTransform: 'uppercase',
                                    }}
                                    >
                                    {field.type}
                                    </span>
                                    <span style={{
                                      background: '#e3f1fc',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      color: '#1976d2',
                                      fontWeight: '500'
                                    }}>
                                      {field.columns === 3 ? 'Full' : field.columns === 2 ? '2/3' : '1/3'} width
                                    </span>
                                    {field.placeholder && (
                                    <span
                                        style={{
                                        fontSize: '12px',
                                        color: '#8c9196',
                                        }}
                                    >
                                        Placeholder: "{field.placeholder}"
                                    </span>
                                    )}
                                </div>
                                </div>
                            </div>
                            </div>
                        ))}
                        </BlockStack>
                    )}
                    </BlockStack>
                </Box>
                </Card>
            </Layout.Section>

            {/* RIGHT SIDEBAR */}
            <Layout.Section variant="oneThird">
                <Card>
                <Box padding="400">
                    <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                        Add New Field
                    </Text>

                    <Divider />

                    <FormLayout>
                        <TextField
                        label="Field Label"
                        value={newFieldLabel}
                        onChange={setNewFieldLabel}
                        placeholder="e.g. Email Address"
                        autoComplete="off"
                        />

                        <Select
                        label="Field Type"
                        options={fieldTypeOptions}
                        value={newFieldType}
                        onChange={setNewFieldType}
                        />

                        <Select
                        label="Column Width"
                        options={columnOptions}
                        value={newFieldColumns}
                        onChange={setNewFieldColumns}
                        helpText="How much horizontal space the field takes"
                        />

                        {newFieldType !== 'checkbox' && (
                        <TextField
                            label="Placeholder (optional)"
                            value={newFieldPlaceholder}
                            onChange={setNewFieldPlaceholder}
                            placeholder="e.g. Enter your email"
                            autoComplete="off"
                        />
                        )}

                        {newFieldType !== 'checkbox' && (
                        <Checkbox
                            label="Required field"
                            checked={newFieldRequired}
                            onChange={setNewFieldRequired}
                        />
                        )}

                        <Button
                        variant="primary"
                        icon={PlusIcon}
                        onClick={handleAddField}
                        disabled={!newFieldLabel.trim()}
                        fullWidth
                        >
                        Add Field
                        </Button>
                    </FormLayout>
                    </BlockStack>
                </Box>
                </Card>
            </Layout.Section>

            </Layout>

            {/* EDIT FIELD MODAL */}
            <Modal
            open={editModalActive}
            limitHeight
            title="Edit Field"
            primaryAction={{
                content: 'Save Changes',
                onAction: handleSaveEditField
            }}
            secondaryActions={[
                { content: 'Cancel', onAction: () => setEditModalActive(false) }
            ]}
            onClose={() => setEditModalActive(false)}
            >
            <Modal.Section>
                <FormLayout>
                <TextField
                    label="Field Label"
                    value={editFieldLabel}
                    onChange={setEditFieldLabel}
                    placeholder="e.g. Email Address"
                    autoComplete="off"
                />

                <Select
                    label="Field Type"
                    options={fieldTypeOptions}
                    value={editFieldType}
                    onChange={setEditFieldType}
                />

                {editFieldType !== 'checkbox' && (
                    <TextField
                    label="Placeholder (optional)"
                    value={editFieldPlaceholder}
                    onChange={setEditFieldPlaceholder}
                    placeholder="e.g. Enter your email"
                    autoComplete="off"
                    />
                )}

                <Select
                    label="Column Width"
                    options={columnOptions}
                    value={editFieldColumns}
                    onChange={setEditFieldColumns}
                    helpText="How much horizontal space the field takes"
                />

                {editFieldType !== 'checkbox' && (
                    <Checkbox
                    label="Required field"
                    checked={editFieldRequired}
                    onChange={setEditFieldRequired}
                    />
                )}
                </FormLayout>
            </Modal.Section>
            </Modal>

            {/* DISCARD CHANGES MODAL */}
            <Modal
            limitHeight
            open={discardModalActive}
            title="Discard changes?"
            primaryAction={{
                content: 'Discard',
                destructive: true,
                onAction: () => navigate('/affiliate-form')
            }}
            secondaryActions={[
                { content: 'Cancel', onAction: () => setDiscardModalActive(false) }
            ]}
            onClose={() => setDiscardModalActive(false)}
            >
            <Modal.Section>
                <TextContainer>
                <p>You have unsaved changes. Are you sure you want to leave?</p>
                </TextContainer>
            </Modal.Section>
            </Modal>

            {/* TOAST */}
            {toastActive && (
            <Toast
                content={toastMessage}
                error={toastError}
                onDismiss={() => setToastActive(false)}
            />
            )}
        </Page>
      </div>
        {/* STICKY FOOTER */}
           <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #e1e3e5',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          zIndex: 100
        }}>
          {/* <Button onClick={() => setPreviewModalActive(true)} disabled={!formFields.length}>
            Preview
          </Button> */}
          <Button onClick={() => handleSave(true)} disabled={!formName.trim() || saving}>
            Save & Publish
          </Button>
          <Button variant="primary" loading={saving} onClick={() => handleSave(false)} disabled={!formName.trim()}>
            Save
          </Button>
        </div>

    </Frame>
  )
}

export default AffiliateFormEditorPage