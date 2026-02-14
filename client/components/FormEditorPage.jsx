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
import { useNavigate, useParams } from 'react-router-dom'
import { getFormById, createForm, updateForm } from '../services/formApi'
import NavBar from './NavBar'

const FormEditorPage = ({ shop }) => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = !!id && id !== 'new'

  // State
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [formName, setFormName] = useState('')
  const [formFields, setFormFields] = useState([])
  const [formStatus, setFormStatus] = useState('Draft')
  const [formSettings, setFormSettings] = useState({
    submitButtonText: 'SEND',
    successMessage: 'Thank you for your submission!',
    description: ''
  })
  const [toastActive, setToastActive] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastError, setToastError] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [discardModalActive, setDiscardModalActive] = useState(false)
  const [previewModalActive, setPreviewModalActive] = useState(false)
  
  // Edit field state
  const [editModalActive, setEditModalActive] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [editFieldLabel, setEditFieldLabel] = useState('')
  const [editFieldType, setEditFieldType] = useState('text')
  const [editFieldRequired, setEditFieldRequired] = useState(false)
  const [editFieldPlaceholder, setEditFieldPlaceholder] = useState('')
  const [editFieldColumns, setEditFieldColumns] = useState('1')
  const [editFieldHelperText, setEditFieldHelperText] = useState('')
  const [editFieldOptions, setEditFieldOptions] = useState('')
  const [editFieldCorrectAnswer, setEditFieldCorrectAnswer] = useState('')
  const [editFieldErrorMessage, setEditFieldErrorMessage] = useState('')

  // New field state
  const [newFieldType, setNewFieldType] = useState('text')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('')
  const [newFieldColumns, setNewFieldColumns] = useState('1')
  const [newFieldHelperText, setNewFieldHelperText] = useState('')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [newFieldCorrectAnswer, setNewFieldCorrectAnswer] = useState('')
  const [newFieldErrorMessage, setNewFieldErrorMessage] = useState('')

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const fieldTypeOptions = [
    { label: 'Text Input', value: 'text' },
    { label: 'Email', value: 'email' },
    { label: 'Phone', value: 'phone' },
    { label: 'Number', value: 'number' },
    { label: 'Textarea', value: 'textarea' },
    { label: 'Select Dropdown', value: 'select' },
    { label: 'Checkbox', value: 'checkbox' },
    { label: 'Date', value: 'date' },
    { label: 'File Upload', value: 'file' },
    { label: 'Description Text', value: 'description' },
  ]

  const columnOptions = [
    { label: '1 Column (1/3 width)', value: '1' },
    { label: '2 Columns (2/3 width)', value: '2' },
    { label: '3 Columns (Full width)', value: '3' },
  ]

  // Fetch form data if editing
  useEffect(() => {
    if (isEditing) {
      fetchForm()
    }
  }, [id])

  const fetchForm = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getFormById(id)
      const form = response.form
      setFormName(form.name || '')
      setFormFields(form.fields || [])
      setFormStatus(form.status || 'Draft')
      setFormSettings(form.settings || {
        submitButtonText: 'Submit',
        successMessage: 'Thank you for your submission!',
        description: ''
      })
    } catch (err) {
      console.error('Error fetching form:', err)
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

  const handleAddField = () => {
    if (!newFieldLabel.trim()) {
      showToast('Field label is required', true)
      return
    }

    const newField = {
      id: Date.now().toString(),
      type: newFieldType,
      label: newFieldLabel.trim(),
      required: newFieldType !== 'description' ? newFieldRequired : false,
      placeholder: newFieldPlaceholder.trim(),
      columns: parseInt(newFieldColumns),
      helperText: newFieldHelperText.trim(),
      options: newFieldType === 'select' && newFieldOptions.trim() 
        ? newFieldOptions.split(',').map(o => o.trim()).filter(o => o)
        : newFieldType === 'select' ? ['Option 1', 'Option 2'] : undefined,
      correctAnswer: (newFieldType === 'text' || newFieldType === 'number') && newFieldCorrectAnswer.trim()
        ? newFieldCorrectAnswer.trim()
        : undefined,
      errorMessage: (newFieldType === 'text' || newFieldType === 'number') && newFieldErrorMessage.trim()
        ? newFieldErrorMessage.trim()
        : undefined
    }

    setFormFields([...formFields, newField])
    setNewFieldLabel('')
    setNewFieldPlaceholder('')
    setNewFieldRequired(false)
    setNewFieldType('text')
    setNewFieldColumns('1')
    setNewFieldHelperText('')
    setNewFieldOptions('')
    setNewFieldCorrectAnswer('')
    setNewFieldErrorMessage('')
    setHasChanges(true)
    showToast('Field added')
  }

  const handleRemoveField = (fieldId) => {
    setFormFields(formFields.filter(field => field.id !== fieldId))
    setHasChanges(true)
  }

  const handleEditField = (field) => {
    setEditingField(field)
    setEditFieldLabel(field.label || '')
    setEditFieldType(field.type || 'text')
    setEditFieldRequired(field.required || false)
    setEditFieldPlaceholder(field.placeholder || '')
    setEditFieldColumns(String(field.columns || 1))
    setEditFieldHelperText(field.helperText || '')
    setEditFieldOptions(field.options ? field.options.join(', ') : '')
    setEditFieldCorrectAnswer(field.correctAnswer || '')
    setEditFieldErrorMessage(field.errorMessage || '')
    setEditModalActive(true)
  }

  const handleSaveEditField = () => {
    if (!editFieldLabel.trim()) {
      showToast('Field label is required', true)
      return
    }

    const updatedField = {
      ...editingField,
      label: editFieldLabel.trim(),
      type: editFieldType,
      required: editFieldType !== 'description' ? editFieldRequired : false,
      placeholder: editFieldPlaceholder.trim(),
      columns: parseInt(editFieldColumns),
      helperText: editFieldHelperText.trim(),
      options: editFieldType === 'select' && editFieldOptions.trim()
        ? editFieldOptions.split(',').map(o => o.trim()).filter(o => o)
        : editFieldType === 'select' ? ['Option 1', 'Option 2'] : undefined,
      correctAnswer: editFieldCorrectAnswer.trim() || undefined,
      errorMessage: editFieldErrorMessage.trim() || undefined
    }

    setFormFields(formFields.map(field => 
      field.id === editingField.id ? updatedField : field
    ))
    setEditModalActive(false)
    setEditingField(null)
    setHasChanges(true)
    showToast('Field updated')
  }

  const handleCancelEditField = () => {
    setEditModalActive(false)
    setEditingField(null)
    setEditFieldCorrectAnswer('')
    setEditFieldErrorMessage('')
  }

  const handleToggleRequired = (fieldId) => {
    setFormFields(formFields.map(field => 
      field.id === fieldId 
        ? { ...field, required: !field.required }
        : field
    ))
    setHasChanges(true)
  }

  const handleMoveField = (index, direction) => {
    const newFields = [...formFields]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newFields.length) return
    
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]]
    setFormFields(newFields)
    setHasChanges(true)
  }

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
    // Add a slight delay to allow the drag image to be set
    setTimeout(() => {
      e.target.style.opacity = '0.5'
    }, 0)
  }

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = (e) => {
    // Only reset if leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null)
    }
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
    setHasChanges(true)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleSave = async (publish = false) => {
    if (!formName.trim()) {
      showToast('Form name is required', true)
      return
    }

    try {
      setSaving(true)
      const formData = {
        name: formName.trim(),
        fields: formFields,
        status: publish ? 'Active' : formStatus,
        settings: formSettings
      }

      if (isEditing) {
        await updateForm(id, formData)
        showToast('Form updated successfully')
      } else {
        await createForm(formData)
        showToast('Form created successfully')
      }
      setHasChanges(false)
      // Navigate back to form builder index page
      navigate('/form-builder')
    } catch (err) {
      showToast(err.message || 'Failed to save form', true)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (hasChanges) {
      setDiscardModalActive(true)
    } else {
      navigate('/form-builder')
    }
  }

  const handleDiscardConfirm = () => {
    setDiscardModalActive(false)
    navigate('/form-builder')
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
        backAction={{ content: 'Forms', onAction: handleBack }}
        title={isEditing ? 'Edit Form' : 'Create New Form'}
        subtitle="Add and configure form fields"
      >
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical" onDismiss={() => setError(null)}>
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}

          {/* Main Content - Form Name and Fields */}
          <Layout.Section>
            {/* Form Name */}
            <Card>
              <Box padding="400">
                <FormLayout>
                  <TextField
                    label="Form Name"
                    value={formName}
                    onChange={(value) => {
                      setFormName(value)
                      setHasChanges(true)
                    }}
                    placeholder="Enter form name"
                    autoComplete="off"
                    requiredIndicator
                  />
                </FormLayout>
              </Box>
            </Card>

            {/* Form Fields List */}
            <Box paddingBlockStart="400">
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
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          style={{
                            cursor: 'grab',
                            transition: 'all 0.2s ease',
                            transform: dragOverIndex === index && draggedIndex !== index 
                              ? 'translateY(4px)' 
                              : 'none',
                            borderTop: dragOverIndex === index && draggedIndex !== null && draggedIndex > index
                              ? '3px solid #7db9b3'
                              : 'none',
                            borderBottom: dragOverIndex === index && draggedIndex !== null && draggedIndex < index
                              ? '3px solid #7db9b3'
                              : 'none',
                          }}
                        >
                          <div
                            style={{
                              background: '#fff',
                              border: '1px solid #e1e3e5',
                              borderRadius: '8px',
                              borderLeft: `4px solid ${field.required ? '#e53935' : '#7db9b3'}`,
                              overflow: 'hidden'
                            }}
                          >
                            <div style={{ padding: '12px 16px' }}>
                              {/* Top Row - Field Name and Actions */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                  <div 
                                    style={{ 
                                      cursor: 'grab',
                                      display: 'flex',
                                      alignItems: 'center',
                                      color: '#8c9196',
                                      padding: '4px'
                                    }}
                                  >
                                    <Icon source={DragHandleIcon} tone="subdued" />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <Text variant="bodyMd" fontWeight="semibold">
                                        {field.label}
                                      </Text>
                                      {field.required && (
                                        <span style={{ 
                                          color: '#e53935', 
                                          fontSize: '12px',
                                          fontWeight: '500'
                                        }}>
                                          Required
                                        </span>
                                      )}
                                      {field.correctAnswer && (
                                        <span style={{ 
                                          color: '#7db9b3', 
                                          fontSize: '11px',
                                          background: '#e8f5f3',
                                          padding: '2px 6px',
                                          borderRadius: '4px'
                                        }}>
                                          ✓ Verification
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button
                                    onClick={() => handleEditField(field)}
                                    style={{
                                      background: 'none',
                                      border: '1px solid #ddd',
                                      borderRadius: '4px',
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      color: '#333',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Icon source={EditIcon} tone="base" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleRemoveField(field.id)}
                                    style={{
                                      background: 'none',
                                      border: '1px solid #fdd',
                                      borderRadius: '4px',
                                      padding: '6px 8px',
                                      cursor: 'pointer',
                                      color: '#e53935',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <Icon source={DeleteIcon} tone="critical" />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Bottom Row - Field Meta Info */}
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px',
                                marginLeft: '32px',
                                flexWrap: 'wrap'
                              }}>
                                <span style={{
                                  background: '#f4f6f8',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  color: '#637381',
                                  fontWeight: '500',
                                  textTransform: 'uppercase'
                                }}>
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
                                  <span style={{
                                    fontSize: '12px',
                                    color: '#8c9196'
                                  }}>
                                    Placeholder: "{field.placeholder}"
                                  </span>
                                )}
                              </div>
                              
                              {/* Helper Text Row */}
                              {field.helperText && (
                                <div style={{ 
                                  marginTop: '8px',
                                  marginLeft: '32px',
                                  padding: '8px 10px',
                                  background: '#f9fafb',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  color: '#637381'
                                }}>
                                  <span style={{ fontWeight: '500' }}>Helper:</span> {field.helperText}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Box>
            </Card>
            </Box>
          </Layout.Section>

          {/* Sidebar - Add New Field and Settings */}
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
                      placeholder="e.g., Your Name"
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
                    {newFieldType !== 'description' && newFieldType !== 'checkbox' && (
                      <TextField
                        label="Placeholder (optional)"
                        value={newFieldPlaceholder}
                        onChange={setNewFieldPlaceholder}
                        placeholder="e.g., Enter your name"
                        autoComplete="off"
                      />
                    )}
                    {newFieldType === 'select' && (
                      <TextField
                        label="Options (comma separated)"
                        value={newFieldOptions}
                        onChange={setNewFieldOptions}
                        placeholder="Option 1, Option 2, Option 3"
                        autoComplete="off"
                        helpText="Leave empty for default options"
                      />
                    )}
                    <TextField
                      label="Helper Text (optional)"
                      value={newFieldHelperText}
                      onChange={setNewFieldHelperText}
                      placeholder="e.g., We'll never share your email"
                      autoComplete="off"
                      helpText="Appears below the field as a hint"
                    />
                    {(newFieldType === 'text' || newFieldType === 'number') && (
                      <>
                        <TextField
                          label="Correct Answer (optional)"
                          value={newFieldCorrectAnswer}
                          onChange={setNewFieldCorrectAnswer}
                          placeholder="e.g., 16"
                          autoComplete="off"
                          helpText="If set, form will only submit when user enters this exact answer (verification question)"
                        />
                        {newFieldCorrectAnswer.trim() && (
                          <TextField
                            label="Error Message"
                            value={newFieldErrorMessage}
                            onChange={setNewFieldErrorMessage}
                            placeholder="e.g., Please enter the correct answer"
                            autoComplete="off"
                            helpText="Message shown when the answer is incorrect"
                          />
                        )}
                      </>
                    )}
                    {newFieldType !== 'description' && (
                      <Checkbox
                        label="Required field"
                        checked={newFieldRequired}
                        onChange={setNewFieldRequired}
                      />
                    )}
                    <Button
                      variant="primary"
                      onClick={handleAddField}
                      disabled={!newFieldLabel.trim()}
                      icon={PlusIcon}
                      fullWidth
                    >
                      Add Field
                    </Button>
                  </FormLayout>
                </BlockStack>
              </Box>
            </Card>

            {/* Form Settings */}
            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                      Form Settings
                    </Text>
                    <Divider />
                    <FormLayout>
                      <TextField
                        label="Form Description"
                        value={formSettings.description || ''}
                        onChange={(value) => {
                          setFormSettings({ ...formSettings, description: value })
                          setHasChanges(true)
                        }}
                        multiline={3}
                        autoComplete="off"
                        helpText="Appears at the top of the form"
                        placeholder="Provide instructions or context for your form..."
                      />
                      <TextField
                        label="Submit Button Text"
                        value={formSettings.submitButtonText}
                        onChange={(value) => {
                          setFormSettings({ ...formSettings, submitButtonText: value })
                          setHasChanges(true)
                        }}
                        autoComplete="off"
                      />
                      <TextField
                        label="Success Message"
                        value={formSettings.successMessage}
                        onChange={(value) => {
                          setFormSettings({ ...formSettings, successMessage: value })
                          setHasChanges(true)
                        }}
                        multiline={2}
                        autoComplete="off"
                      />
                    </FormLayout>
                  </BlockStack>
                </Box>
              </Card>
            </Box>

            {/* Field Types Info */}
            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h2">
                      Available Field Types
                    </Text>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: '8px',
                      marginTop: '8px'
                    }}>
                      {[
                        { value: 'text', label: 'Text', icon: 'Aa', color: '#5c6ac4' },
                        { value: 'email', label: 'Email', icon: '@', color: '#007ace' },
                        { value: 'phone', label: 'Phone', icon: '📞', color: '#50b83c' },
                        { value: 'number', label: 'Number', icon: '#', color: '#9c6ade' },
                        { value: 'textarea', label: 'Textarea', icon: '¶', color: '#47c1bf' },
                        { value: 'select', label: 'Dropdown', icon: '▼', color: '#f49342' },
                        { value: 'checkbox', label: 'Checkbox', icon: '☑', color: '#de3618' },
                        { value: 'date', label: 'Date', icon: '📅', color: '#8c6e63' },
                        { value: 'file', label: 'File Upload', icon: '📎', color: '#637381' },
                        { value: 'description', label: 'Text Block', icon: 'ℹ', color: '#919eab' },
                      ].map((type) => (
                        <div
                          key={type.value}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            border: '1px solid #e1e3e5',
                            cursor: 'default'
                          }}
                        >
                          <span style={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: type.color,
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}>
                            {type.icon}
                          </span>
                          <span style={{
                            fontSize: '13px',
                            color: '#202223',
                            fontWeight: '500'
                          }}>
                            {type.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </BlockStack>
                </Box>
              </Card>
            </Box>
          </Layout.Section>
        </Layout>

        {/* Edit Field Modal */}
        <Modal
          limitHeight
          open={editModalActive}
          onClose={handleCancelEditField}
          title="Edit Field"
          primaryAction={{
            content: 'Save Changes',
            onAction: handleSaveEditField,
            disabled: !editFieldLabel.trim()
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: handleCancelEditField,
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Field Label"
                value={editFieldLabel}
                onChange={setEditFieldLabel}
                placeholder="e.g., Your Name"
                autoComplete="off"
                requiredIndicator
              />
              <Select
                label="Field Type"
                options={fieldTypeOptions}
                value={editFieldType}
                onChange={setEditFieldType}
              />
              <Select
                label="Column Width"
                options={columnOptions}
                value={editFieldColumns}
                onChange={setEditFieldColumns}
                helpText="How much horizontal space the field takes"
              />
              {editFieldType !== 'description' && editFieldType !== 'checkbox' && (
                <TextField
                  label="Placeholder (optional)"
                  value={editFieldPlaceholder}
                  onChange={setEditFieldPlaceholder}
                  placeholder="e.g., Enter your name"
                  autoComplete="off"
                />
              )}
              {editFieldType === 'select' && (
                <TextField
                  label="Options (comma separated)"
                  value={editFieldOptions}
                  onChange={setEditFieldOptions}
                  placeholder="Option 1, Option 2, Option 3"
                  autoComplete="off"
                  helpText="Leave empty for default options"
                />
              )}
              <TextField
                label="Helper Text (optional)"
                value={editFieldHelperText}
                onChange={setEditFieldHelperText}
                placeholder="e.g., We'll never share your email"
                autoComplete="off"
                helpText="Appears below the field as a hint"
              />
              {(editFieldType === 'text' || editFieldType === 'number') && (
                <>
                  <TextField
                    label="Correct Answer (optional)"
                    value={editFieldCorrectAnswer}
                    onChange={setEditFieldCorrectAnswer}
                    placeholder="e.g., 16"
                    autoComplete="off"
                    helpText="If set, form will only submit when user enters this exact answer (verification question)"
                  />
                  {editFieldCorrectAnswer && (
                    <TextField
                      label="Error Message"
                      value={editFieldErrorMessage}
                      onChange={setEditFieldErrorMessage}
                      placeholder="e.g., Please enter the correct answer"
                      autoComplete="off"
                      helpText="Message shown when the answer is incorrect"
                    />
                  )}
                </>
              )}
              {editFieldType !== 'description' && (
                <Checkbox
                  label="Required field"
                  checked={editFieldRequired}
                  onChange={setEditFieldRequired}
                />
              )}
            </FormLayout>
          </Modal.Section>
        </Modal>

        {/* Discard Changes Modal */}
        <Modal
          limitHeight  
          open={discardModalActive}
          onClose={() => setDiscardModalActive(false)}
          title="Discard unsaved changes?"
          primaryAction={{
            content: 'Discard',
            destructive: true,
            onAction: handleDiscardConfirm,
          }}
          secondaryActions={[
            {
              content: 'Keep editing',
              onAction: () => setDiscardModalActive(false),
            },
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <p>
                You have unsaved changes. Are you sure you want to leave this page?
              </p>
            </TextContainer>
          </Modal.Section>
        </Modal>

        {/* Preview Modal */}
        <Modal
          limitHeight
          open={previewModalActive}
          onClose={() => setPreviewModalActive(false)}
          title={`Preview: ${formName || 'Untitled Form'}`}
          size="large"
          secondaryActions={[
            {
              content: 'Close',
              onAction: () => setPreviewModalActive(false),
            },
          ]}
        >
          <Modal.Section>
            <div 
              style={{ 
                background: '#f8fbfd', 
                padding: '30px', 
                borderRadius: '8px',
                maxHeight: '70vh',
                overflow: 'auto',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}
            >
              {/* Form Description */}
              {formSettings.description && (
                <p style={{
                  textAlign: 'center',
                  color: '#333',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  marginBottom: '30px',
                  padding: '0 20px'
                }}>
                  {formSettings.description}
                </p>
              )}
              
              {/* Form Fields - Grouped into rows based on columns */}
              {(() => {
                const rows = [];
                let currentRow = [];
                let columnsUsed = 0;
                const maxColumns = 6; // 6-column grid: col-1=1unit, col-2=2units, col-3=6units(full)
                
                formFields.forEach((field, index) => {
                  const columns = field.columns || 1;
                  const isFullWidth = columns === 3 || field.type === 'textarea' || field.type === 'file' || field.type === 'description';
                  
                  // Calculate column units: col-1=1, col-2=2, col-3(full)=6
                  // This allows up to 6 col-1 fields, 3 col-2 fields, or 1 full-width field per row
                  const colUnits = isFullWidth ? 6 : (columns === 2 ? 2 : 1);
                  
                  // Start new row if needed (if full width or won't fit in current row)
                  if (isFullWidth || (columnsUsed + colUnits > maxColumns)) {
                    if (currentRow.length > 0) {
                      rows.push([...currentRow]);
                    }
                    currentRow = [field];
                    columnsUsed = colUnits;
                  } else {
                    currentRow.push(field);
                    columnsUsed += colUnits;
                  }
                  
                  // If row is full, push it
                  if (columnsUsed >= maxColumns) {
                    rows.push([...currentRow]);
                    currentRow = [];
                    columnsUsed = 0;
                  }
                });
                
                // Push remaining fields
                if (currentRow.length > 0) {
                  rows.push(currentRow);
                }
                
                return rows.map((row, rowIndex) => (
                  <div 
                    key={rowIndex} 
                    style={{ 
                      display: 'flex', 
                      gap: '20px', 
                      marginBottom: '20px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {row.map((field) => {
                      const columns = field.columns || 1;
                      const isFullWidth = columns === 3 || field.type === 'textarea' || field.type === 'file' || field.type === 'description';
                      // Use flex-grow to allow fields to share row space evenly
                      const flexValue = isFullWidth ? '0 0 100%' : '1 1 calc(33.333% - 14px)';
                      const minWidth = isFullWidth ? '100%' : '150px';
                      
                      // Render field
                      const renderFieldInput = () => {
                        if (field.type === 'textarea') {
                          return (
                            <textarea
                              style={{
                                width: '100%',
                                padding: '12px 15px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                minHeight: '120px',
                                resize: 'vertical',
                                boxSizing: 'border-box',
                                color: '#333',
                                background: '#fff'
                              }}
                              placeholder={field.placeholder || ''}
                              disabled
                            />
                          );
                        }
                        
                        if (field.type === 'select') {
                          return (
                            <select
                              style={{
                                width: '100%',
                                padding: '12px 15px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                background: '#fff',
                                boxSizing: 'border-box',
                                color: '#333'
                              }}
                              disabled
                            >
                              <option>{field.placeholder || 'Select an option'}</option>
                              {(field.options || ['Option 1', 'Option 2']).map((opt, i) => (
                                <option key={i}>{opt}</option>
                              ))}
                            </select>
                          );
                        }
                        
                        if (field.type === 'checkbox') {
                          return (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                              <input
                                type="checkbox"
                                style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                                disabled
                              />
                              <label style={{ fontSize: '14px', color: '#333' }}>
                                {field.label}
                                {field.required && <span style={{ color: '#e53935' }}>*</span>}
                              </label>
                            </div>
                          );
                        }
                        
                        if (field.type === 'file') {
                          return (
                            <input
                              type="file"
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                background: '#fff',
                                boxSizing: 'border-box'
                              }}
                              disabled
                            />
                          );
                        }
                        
                        return (
                          <input
                            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            style={{
                              width: '100%',
                              padding: '12px 15px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              color: '#333',
                              background: '#fff'
                            }}
                            placeholder={field.placeholder || ''}
                            disabled
                          />
                        );
                      };
                      
                      // Description type
                      if (field.type === 'description') {
                        return (
                          <div 
                            key={field.id} 
                            style={{ 
                              flex: flexValue, 
                              minWidth: minWidth 
                            }}
                          >
                            <p style={{
                              fontSize: '13px',
                              color: '#666',
                              fontStyle: 'italic',
                              marginTop: '15px'
                            }}>
                              {field.label}
                            </p>
                          </div>
                        );
                      }
                      
                      return (
                        <div 
                          key={field.id} 
                          style={{ 
                            flex: flexValue, 
                            minWidth: minWidth 
                          }}
                        >
                          {field.type !== 'checkbox' && (
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              fontSize: '14px',
                              color: '#333',
                              fontWeight: '400'
                            }}>
                              {field.label}
                              {field.required && <span style={{ color: '#e53935' }}>*</span>}
                            </label>
                          )}
                          
                          {renderFieldInput()}
                          
                          {field.helperText && (
                            <p style={{
                              fontSize: '13px',
                              color: '#666',
                              marginTop: '5px',
                              fontStyle: 'italic'
                            }}>
                              {field.helperText}
                            </p>
                          )}
                          
                          {field.correctAnswer && (
                            <p style={{
                              fontSize: '12px',
                              color: '#7db9b3',
                              marginTop: '5px'
                            }}>
                              ✓ Verification question (correct answer: {field.correctAnswer})
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
              
              {/* Submit Button */}
              <div style={{ marginTop: '10px' }}>
                <button
                  style={{
                    backgroundColor: '#7db9b3',
                    color: 'white',
                    padding: '14px 40px',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'not-allowed',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    opacity: 0.7
                  }}
                  disabled
                >
                  {formSettings.submitButtonText || 'SEND'}
                </button>
              </div>
              
              {/* Preview Note */}
              <div style={{
                marginTop: '20px',
                padding: '10px',
                background: '#e8f5f3',
                borderRadius: '4px',
                borderLeft: '4px solid #7db9b3'
              }}>
                <Text tone="subdued" variant="bodySm">
                  This is a preview. Form submission is disabled. Save and publish the form, then copy the embed script to use it on your site.
                </Text>
              </div>
            </div>
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
      </div>
      
      {/* Sticky Bottom Action Bar */}
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
        zIndex: 100,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
      }}>
        <Button
          onClick={() => setPreviewModalActive(true)}
          disabled={formFields.length === 0}
        >
          Preview
        </Button>
        <Button
          onClick={() => handleSave(true)}
          disabled={saving || !formName.trim()}
        >
          Save & Publish
        </Button>
        <Button
          variant="primary"
          onClick={() => handleSave(false)}
          loading={saving}
          disabled={!formName.trim()}
        >
          {saving ? 'Saving...' : 'Save Form'}
        </Button>
      </div>
    </Frame>
  )
}

export default FormEditorPage
