import React, { useState, useCallback, useEffect } from 'react'
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  TextField,
  Box,
  InlineStack,
  BlockStack,
  Frame,
  Badge,
  Icon,
  EmptyState,
  IndexTable,
  Tabs,
  Tooltip,
  Modal,
  TextContainer,
  Toast,
  Spinner,
  Banner,
  Pagination
} from '@shopify/polaris'
import {
  PlusIcon,
  DeleteIcon,
  EditIcon,
  ClipboardIcon,
  SearchIcon,
  RefreshIcon,
  ExportIcon
} from '@shopify/polaris-icons'
import { useNavigate } from 'react-router-dom'
import { 
  getForms, 
  deleteForm, 
  duplicateForm, 
  updateFormStatus,
  exportSubmissions 
} from '../services/formApi'
import NavBar from './NavBar'

const FormBuilderPage = ({ shop }) => {
  const navigate = useNavigate()
  
  // State
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTab, setSelectedTab] = useState(0)
  const [searchValue, setSearchValue] = useState('')
  const [deleteModalActive, setDeleteModalActive] = useState(false)
  const [formToDelete, setFormToDelete] = useState(null)
  const [toastActive, setToastActive] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastError, setToastError] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const formsPerPage = 8

  // Fetch forms on mount
  useEffect(() => {
    fetchForms()
  }, [])

  const fetchForms = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getForms()
      setForms(response.forms || [])
    } catch (err) {
      console.error('Error fetching forms:', err)
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

  const tabs = [
    { id: 'all', content: 'All', badge: forms.length.toString() },
    { id: 'published', content: 'Published', badge: forms.filter(f => f.status === 'Active').length.toString() },
    { id: 'draft', content: 'Draft', badge: forms.filter(f => f.status === 'Draft').length.toString() },
  ]

  const resourceName = {
    singular: 'form',
    plural: 'forms',
  }

  // Filter forms based on tab and search
  const filteredForms = forms.filter(form => {
    const matchesTab = selectedTab === 0 || 
      (selectedTab === 1 && form.status === 'Active') ||
      (selectedTab === 2 && form.status === 'Draft')
    
    const matchesSearch = form.name.toLowerCase().includes(searchValue.toLowerCase())
    
    return matchesTab && matchesSearch
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredForms.length / formsPerPage)
  const startIndex = (currentPage - 1) * formsPerPage
  const endIndex = startIndex + formsPerPage
  const paginatedForms = filteredForms.slice(startIndex, endIndex)


  const handleTabChange = useCallback((selectedTabIndex) => {
    setSelectedTab(selectedTabIndex)
    setCurrentPage(1) // Reset to first page when changing tabs
  }, [])

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value)
    setCurrentPage(1) // Reset to first page when searching
  }, [])

  const handleSearchClear = useCallback(() => {
    setSearchValue('')
  }, [])

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${type} copied to clipboard`)
    } catch (err) {
      showToast('Failed to copy to clipboard', true)
    }
  }

  // Generate embeddable script for a form
//   const generateEmbedScript = (form) => {
//     // Don't generate script for unpublished forms
//     if (form.status !== 'Active') {
//       return `<!-- KiScience Form Builder - ${form.name} -->
// <!-- This form is currently unpublished. Please publish the form to get the embed script. -->`
//     }
    
//     const appUrl = window.location.origin
//     const script = `<!-- KiScience Form Builder - ${form.name} -->
// <style>
//   .kiscience-form-container {
//     max-width: 100%;
//     margin: 0 auto;
//     padding: 30px;
//     font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
//     background: #f8fbfd;
//     border-radius: 8px;
//   }
//   .kiscience-form-description {
//     text-align: center;
//     color: #333;
//     font-size: 15px;
//     line-height: 1.6;
//     margin-bottom: 30px;
//     padding: 0 20px;
//   }
//   .kiscience-form-row {
//     display: flex;
//     gap: 20px;
//     margin-bottom: 20px;
//     flex-wrap: wrap;
//   }
//   .kiscience-form-field {
//     flex: 1;
//     min-width: 200px;
//   }
//   .kiscience-form-field.col-1 {
//     flex: 1 1 calc(33.333% - 14px);
//     min-width: 150px;
//   }
//   .kiscience-form-field.col-2 {
//     flex: 1 1 calc(33.333% - 14px);
//     min-width: 200px;
//   }
//   .kiscience-form-field.full-width {
//     flex: 0 0 100%;
//     min-width: 100%;
//     max-width: 100%;
//   }
//   .kiscience-form-label {
//     display: block;
//     margin-bottom: 8px;
//     font-size: 14px;
//     color: #333;
//     font-weight: 400;
//   }
//   .kiscience-form-label .required {
//     color: #e53935;
//   }
//   .kiscience-form-input,
//   .kiscience-form-select,
//   .kiscience-form-textarea {
//     width: 100%;
//     padding: 12px 15px;
//     border: 1px solid #ddd;
//     border-radius: 4px;
//     font-size: 14px;
//     color: #333;
//     background: #fff;
//     box-sizing: border-box;
//     transition: border-color 0.2s, box-shadow 0.2s;
//   }
//   .kiscience-form-input:focus,
//   .kiscience-form-select:focus,
//   .kiscience-form-textarea:focus {
//     outline: none;
//     border-color: #7db9b3;
//     box-shadow: 0 0 0 3px rgba(125, 185, 179, 0.1);
//   }
//   .kiscience-form-input::placeholder,
//   .kiscience-form-textarea::placeholder {
//     color: #999;
//   }
//   .kiscience-form-textarea {
//     min-height: 120px;
//     resize: vertical;
//   }
//   .kiscience-form-file-wrapper {
//     position: relative;
//   }
//   .kiscience-form-file-input {
//     width: 100%;
//     padding: 10px;
//     border: 1px solid #ddd;
//     border-radius: 4px;
//     background: #fff;
//     cursor: pointer;
//   }
//   .kiscience-form-helper {
//     font-size: 13px;
//     color: #666;
//     margin-top: 15px;
//     font-style: italic;
//   }
//   .kiscience-form-helper a {
//     color: #7db9b3;
//     text-decoration: none;
//   }
//   .kiscience-form-helper a:hover {
//     text-decoration: underline;
//   }
//   .kiscience-form-checkbox-wrapper {
//     display: flex;
//     align-items: flex-start;
//     gap: 10px;
//   }
//   .kiscience-form-checkbox {
//     width: 18px;
//     height: 18px;
//     margin-top: 2px;
//     cursor: pointer;
//   }
//   .kiscience-form-submit {
//     background-color: #6090ab;
//     color: white;
//     padding: 14px 40px;
//     border: none;
//     border-radius: 4px;
//     font-size: 16px;
//     font-weight: 600;
//     cursor: pointer;
//     text-transform: uppercase;
//     letter-spacing: 1px;
//     transition: background-color 0.2s;
//     margin-top: 10px;
//   }
//   .kiscience-form-submit:hover {
//     background-color: #6aa9a3;
//   }
//   .kiscience-form-submit:disabled {
//     background-color: #ccc;
//     cursor: not-allowed;
//   }
//   .kiscience-form-message {
//     margin-top: 20px;
//     padding: 15px;
//     border-radius: 4px;
//     text-align: center;
//     display: none;
//   }
//   .kiscience-form-message.success {
//     background-color: #d4edda;
//     color: #155724;
//     border: 1px solid #c3e6cb;
//   }
//   .kiscience-form-message.error {
//     background-color: #f8d7da;
//     color: #721c24;
//     border: 1px solid #f5c6cb;
//   }
//   .kiscience-form-message.fade-out {
//     opacity: 0;
//     transition: opacity 0.5s ease-out;
//   }
//   @media (max-width: 600px) {
//     .kiscience-form-row {
//       flex-direction: column;
//     }
//     .kiscience-form-field,
//     .kiscience-form-field.col-1,
//     .kiscience-form-field.col-2 {
//       flex: 0 0 100%;
//       max-width: 100%;
//       min-width: 100%;
//     }
//   }
// </style>
// <div id="kiscience-form-${form.formId}" class="kiscience-form-container"></div>
// <script>
// (function() {
//   var formId = "${form.formId}";
//   var containerId = "kiscience-form-${form.formId}";
//   var apiUrl = "${appUrl}/api/forms/" + formId + "/submit";
  
//   var formConfig = JSON.parse('${JSON.stringify({
//     name: form.name,
//     description: form.settings?.description || '',
//     fields: form.fields || [],
//     settings: form.settings || {}
//   }).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/</g, '\\x3c').replace(/>/g, '\\x3e')}');
  
//   function createForm() {
//     var container = document.getElementById(containerId);
//     if (!container) return;
    
//     var form = document.createElement('form');
//     form.id = 'kiscience-form-element-' + formId;
    
//     // Add description if exists
//     if (formConfig.description || formConfig.settings.description) {
//       var desc = document.createElement('p');
//       desc.className = 'kiscience-form-description';
//       desc.innerHTML = formConfig.description || formConfig.settings.description;
//       form.appendChild(desc);
//     }
    
//     // Group fields into rows based on column settings
//     var currentRow = null;
//     var columnsUsed = 0;
//     var maxColumns = 6; // Using 6-column grid: col-1=1unit, col-2=2units, col-3=6units(full)
    
//     formConfig.fields.forEach(function(field, index) {
//       var columns = field.columns || 1;
//       var isFullWidth = columns === 3 || field.type === 'textarea' || field.type === 'file' || field.type === 'description';
      
//       // Calculate column units: col-1=1, col-2=2, col-3(full)=6
//       // This allows up to 6 col-1 fields, 3 col-2 fields, or 1 full-width field per row
//       var colUnits = isFullWidth ? 6 : (columns === 2 ? 2 : 1);
      
//       // Create new row if needed (if full width or won't fit in current row)
//       if (!currentRow || isFullWidth || (columnsUsed + colUnits > maxColumns)) {
//         currentRow = document.createElement('div');
//         currentRow.className = 'kiscience-form-row';
//         form.appendChild(currentRow);
//         columnsUsed = 0;
//       }
      
//       var fieldContainer = document.createElement('div');
//       var colClass = isFullWidth ? ' full-width' : (columns === 2 ? ' col-2' : (columns === 1 ? ' col-1' : ''));
//       fieldContainer.className = 'kiscience-form-field' + colClass;
      
//       // Handle description type (just text, no input)
//       if (field.type === 'description') {
//         var descText = document.createElement('p');
//         descText.className = 'kiscience-form-helper';
//         descText.innerHTML = field.label;
//         fieldContainer.appendChild(descText);
//         currentRow.appendChild(fieldContainer);
//         columnsUsed += colUnits;
//         return;
//       }
      
//       // Create label
//       var label = document.createElement('label');
//       label.className = 'kiscience-form-label';
//       label.innerHTML = field.label + (field.required ? '<span class="required">*</span>' : '');
//       label.setAttribute('for', 'field-' + field.id);
      
//       if (field.type !== 'checkbox') {
//         fieldContainer.appendChild(label);
//       }
      
//       var input;
      
//       if (field.type === 'textarea') {
//         input = document.createElement('textarea');
//         input.className = 'kiscience-form-textarea';
//         input.rows = field.rows || 4;
//       } else if (field.type === 'select') {
//         input = document.createElement('select');
//         input.className = 'kiscience-form-select';
//         var defaultOption = document.createElement('option');
//         defaultOption.value = '';
//         defaultOption.textContent = field.placeholder || 'Select an option';
//         input.appendChild(defaultOption);
//         (field.options || []).forEach(function(opt) {
//           var option = document.createElement('option');
//           option.value = opt;
//           option.textContent = opt;
//           input.appendChild(option);
//         });
//       } else if (field.type === 'checkbox') {
//         var checkWrapper = document.createElement('div');
//         checkWrapper.className = 'kiscience-form-checkbox-wrapper';
//         input = document.createElement('input');
//         input.type = 'checkbox';
//         input.className = 'kiscience-form-checkbox';
//         checkWrapper.appendChild(input);
//         checkWrapper.appendChild(label);
//         fieldContainer.appendChild(checkWrapper);
//       } else if (field.type === 'file') {
//         var fileWrapper = document.createElement('div');
//         fileWrapper.className = 'kiscience-form-file-wrapper';
//         input = document.createElement('input');
//         input.type = 'file';
//         input.className = 'kiscience-form-file-input';
//         input.accept = field.accept || 'image/*,.pdf,.doc,.docx';
//         if (field.multiple) input.multiple = true;
//         fileWrapper.appendChild(input);
//         fieldContainer.appendChild(fileWrapper);
//       } else {
//         input = document.createElement('input');
//         input.className = 'kiscience-form-input';
//         input.type = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
//       }
      
//       input.id = 'field-' + field.id;
//       input.name = field.id;
//       if (field.required) input.required = true;
//       if (field.placeholder && field.type !== 'select') input.placeholder = field.placeholder;
      
//       if (field.type !== 'checkbox' && field.type !== 'file') {
//         fieldContainer.appendChild(input);
//       } else if (field.type === 'file') {
//         // Already added above
//       }
      
//       // Add helper text if exists
//       if (field.helperText) {
//         var helper = document.createElement('p');
//         helper.className = 'kiscience-form-helper';
//         helper.innerHTML = field.helperText;
//         fieldContainer.appendChild(helper);
//       }
      
//       currentRow.appendChild(fieldContainer);
//       columnsUsed += colUnits;
//     });
    
//     // Submit button row
//     var submitRow = document.createElement('div');
//     submitRow.className = 'kiscience-form-row';
//     var submitField = document.createElement('div');
//     submitField.className = 'kiscience-form-field';
    
//     var submitBtn = document.createElement('button');
//     submitBtn.type = 'submit';
//     submitBtn.className = 'kiscience-form-submit';
//     submitBtn.textContent = formConfig.settings.submitButtonText || 'SEND';
//     submitField.appendChild(submitBtn);
//     submitRow.appendChild(submitField);
//     form.appendChild(submitRow);
    
//     // Message container
//     var messageDiv = document.createElement('div');
//     messageDiv.id = 'kiscience-message-' + formId;
//     messageDiv.className = 'kiscience-form-message';
//     form.appendChild(messageDiv);
    
//     function isEmptyOrSpaces(value) {
//       return !value || value.trim().length === 0;
//     }

//     // Form submission handler
//     form.onsubmit = function(e) {
//       e.preventDefault();
      
//       // Validate verification/captcha fields first
//       var validationError = null;
//       formConfig.fields.forEach(function(field) {
//         if (field.correctAnswer) {
//           var input = document.getElementById('field-' + field.id);
//           if (input) {
//             var userAnswer = input.value.trim().toLowerCase();
//             var correctAnswer = String(field.correctAnswer).trim().toLowerCase();
//             if (userAnswer !== correctAnswer) {
//               validationError = field.errorMessage || 'Please provide the correct answer to the verification question.';
//             }
//           }
//         }
//       });
      
//       if (validationError) {
//         var msgEl = document.getElementById('kiscience-message-' + formId);
//         if (msgEl) {
//           msgEl.style.display = 'block';
//           msgEl.className = 'kiscience-form-message error';
//           msgEl.textContent = validationError;
          
//           // Auto-hide error after 4 seconds
//           setTimeout(function() {
//             var msgToHide = document.getElementById('kiscience-message-' + formId);
//             if (msgToHide) {
//               msgToHide.classList.add('fade-out');
//               setTimeout(function() {
//                 var msgToRemove = document.getElementById('kiscience-message-' + formId);
//                 if (msgToRemove) {
//                   msgToRemove.style.display = 'none';
//                   msgToRemove.classList.remove('fade-out');
//                 }
//               }, 500);
//             }
//           }, 4000);
//         }
//         return;
//       }
      
//       submitBtn.disabled = true;
//       submitBtn.textContent = 'Sending...';
      
//       // Always use FormData to support file uploads
//       var formDataObj = new FormData();
//       var hasFiles = false;
      
//       console.log('=== KiScience Form Submit Debug ===');
      
//       formConfig.fields.forEach(function(field) {
//         // Skip non-input fields
//         if (field.type === 'description') return;

//         var input = document.getElementById('field-' + field.id);

//         console.log(
//           'Field:',
//           field.id,
//           'Label:',
//           field.label,
//           'Type:',
//           field.type,
//           'Input found:',
//           !!input
//         );

//         if (!input) return;

//         // 🚫 SPACE / EMPTY VALIDATION (required fields only)
//         if (
//           field.required &&
//           field.type !== 'file' &&
//           field.type !== 'checkbox' &&
//           isEmptyOrSpaces(input.value)
//         ) {
//           validationError = field.errorMessage || (field.label + ' is required');
//           return;
//         }

//         // ✅ Append values
//         if (field.type === 'checkbox') {
//           formDataObj.append(field.id, input.checked ? 'true' : 'false');
//           console.log('  Checkbox value:', input.checked);

//         } else if (field.type === 'file') {
//           console.log('  File input files:', input.files ? input.files.length : 0);

//           if (input.files && input.files.length > 0) {
//             hasFiles = true;
//             for (var i = 0; i < input.files.length; i++) {
//               console.log(
//                 '  Adding file:',
//                 input.files[i].name,
//                 'Size:',
//                 input.files[i].size
//               );
//               formDataObj.append(field.id, input.files[i]);
//             }
//           }

//         } else {
//           // ✂️ Trim before saving
//           formDataObj.append(field.id, input.value.trim());
//           console.log('  Text value:', input.value.trim());
//         }
//       });

      
//       // Add metadata
//       formDataObj.append('metadata', JSON.stringify({ page: window.location.href }));
      
//       console.log('Has files:', hasFiles);
//       console.log('Submitting with FormData...');
//       console.log('===================================');
      
//       // Always use FormData (works for both with and without files)
//       fetch(apiUrl, {
//         method: 'POST',
//         body: formDataObj
//       })
//       .then(function(response) { return response.json(); })
//       .then(function(result) {
//         var msgEl = document.getElementById('kiscience-message-' + formId);
//         if (msgEl) {
//           msgEl.style.display = 'block';
//           msgEl.className = 'kiscience-form-message ' + (result.success ? 'success' : 'error');
//           msgEl.textContent = result.success 
//             ? (formConfig.settings.successMessage || 'Thank you for your submission!')
//             : (result.error || 'Submission failed. Please try again.');
          
//           // Auto-hide message after 4 seconds with fade effect
//           setTimeout(function() {
//             var msgToHide = document.getElementById('kiscience-message-' + formId);
//             if (msgToHide) {
//               msgToHide.classList.add('fade-out');
//               setTimeout(function() {
//                 var msgToRemove = document.getElementById('kiscience-message-' + formId);
//                 if (msgToRemove) {
//                   msgToRemove.style.display = 'none';
//                   msgToRemove.classList.remove('fade-out');
//                 }
//               }, 500);
//             }
//           }, 4000);
//         }
//         if (result.success) form.reset();
//         submitBtn.disabled = false;
//         submitBtn.textContent = formConfig.settings.submitButtonText || 'SEND';
//       })
//       .catch(function(error) {
//         var msgEl = document.getElementById('kiscience-message-' + formId);
//         if (msgEl) {
//           msgEl.style.display = 'block';
//           msgEl.className = 'kiscience-form-message error';
//           msgEl.textContent = 'An error occurred. Please try again.';
          
//           // Auto-hide message after 4 seconds with fade effect
//           setTimeout(function() {
//             var msgToHide = document.getElementById('kiscience-message-' + formId);
//             if (msgToHide) {
//               msgToHide.classList.add('fade-out');
//               setTimeout(function() {
//                 var msgToRemove = document.getElementById('kiscience-message-' + formId);
//                 if (msgToRemove) {
//                   msgToRemove.style.display = 'none';
//                   msgToRemove.classList.remove('fade-out');
//                 }
//               }, 500);
//             }
//           }, 4000);
//         }
//         submitBtn.disabled = false;
//         submitBtn.textContent = formConfig.settings.submitButtonText || 'SEND';
//       });
//     };
    
//     container.appendChild(form);
//   }
  
//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', createForm);
//   } else {
//     createForm();
//   }
// })();
// </script>
// <!-- End KiScience Form Builder -->`
//     return script
//   }

  const generateEmbedScript = (form) => {
    // Don't generate script for unpublished forms
    if (form.status !== 'Active') {
      return `<!-- KiScience Form Builder - ${form.name} -->
  <!-- This form is currently unpublished. Please publish the form to get the embed script. -->`
    }
    
    const appUrl = window.location.origin
    const script = `<!-- KiScience Form Builder - ${form.name} -->
  <style>
  .kiscience-form-container {
    max-width: 100%;
    margin: 0 auto;
    padding: 30px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f8fbfd;
    border-radius: 8px;
  }
  .kiscience-form-description {
    text-align: center;
    color: #333;
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 30px;
    padding: 0 20px;
  }
  .kiscience-form-row {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .kiscience-form-field {
    flex: 1;
    min-width: 200px;
  }
  .kiscience-form-field.col-1 {
    flex: 1 1 calc(33.333% - 14px);
    min-width: 150px;
  }
  .kiscience-form-field.col-2 {
    flex: 1 1 calc(33.333% - 14px);
    min-width: 200px;
  }
  .kiscience-form-field.full-width {
    flex: 0 0 100%;
    min-width: 100%;
    max-width: 100%;
  }
  .kiscience-form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    color: #333;
    font-weight: 400;
  }
  .kiscience-form-label .required {
    color: #e53935;
  }
  .kiscience-form-input,
  .kiscience-form-select,
  .kiscience-form-textarea {
    width: 100%;
    padding: 12px 15px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    color: #333;
    background: #fff;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .kiscience-form-input:focus,
  .kiscience-form-select:focus,
  .kiscience-form-textarea:focus {
    outline: none;
    border-color: #7db9b3;
    box-shadow: 0 0 0 3px rgba(125, 185, 179, 0.1);
  }
  .kiscience-form-input::placeholder,
  .kiscience-form-textarea::placeholder {
    color: #999;
  }
  .kiscience-form-textarea {
    min-height: 120px;
    resize: vertical;
  }
  .kiscience-form-file-wrapper {
    position: relative;
  }
  .kiscience-form-file-input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
  .kiscience-form-helper {
    font-size: 13px;
    color: #666;
    margin-top: 15px;
    font-style: italic;
  }
  .kiscience-form-helper a {
    color: #7db9b3;
    text-decoration: none;
  }
  .kiscience-form-helper a:hover {
    text-decoration: underline;
  }
  .kiscience-form-checkbox-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .kiscience-form-checkbox {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    cursor: pointer;
  }
  .kiscience-form-submit {
    background-color: #6090ab;
    color: white;
    padding: 14px 40px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: background-color 0.2s;
    margin-top: 10px;
  }
  .kiscience-form-submit:hover {
    background-color: #6aa9a3;
  }
  .kiscience-form-submit:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  .kiscience-form-message {
    margin-top: 20px;
    padding: 15px;
    border-radius: 4px;
    text-align: center;
    display: none;
  }
  .kiscience-form-message.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }
  .kiscience-form-message.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }
  .kiscience-form-message.fade-out {
    opacity: 0;
    transition: opacity 0.5s ease-out;
  }
  .kiscience-form-input.error,
  .kiscience-form-textarea.error,
  .kiscience-form-select.error {
    border-color: #e53935;
  }
  @media (max-width: 600px) {
    .kiscience-form-row {
      flex-direction: column;
    }
    .kiscience-form-field,
    .kiscience-form-field.col-1,
    .kiscience-form-field.col-2 {
      flex: 0 0 100%;
      max-width: 100%;
      min-width: 100%;
    }
  }
  </style>
  <div id="kiscience-form-${form.formId}" class="kiscience-form-container"></div>
  <script>
  (function() {
  var formId = "${form.formId}";
  var containerId = "kiscience-form-${form.formId}";
  var apiUrl = "${appUrl}/api/forms/" + formId + "/submit";

  var formConfig = JSON.parse('${JSON.stringify({
    name: form.name,
    description: form.settings?.description || '',
    fields: form.fields || [],
    settings: form.settings || {}
  }).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/</g, '\\x3c').replace(/>/g, '\\x3e')}');

  function createForm() {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var form = document.createElement('form');
    form.id = 'kiscience-form-element-' + formId;
    
    // Add description if exists
    if (formConfig.description || formConfig.settings.description) {
      var desc = document.createElement('p');
      desc.className = 'kiscience-form-description';
      desc.innerHTML = formConfig.description || formConfig.settings.description;
      form.appendChild(desc);
    }
    
    // Group fields into rows based on column settings
    var currentRow = null;
    var columnsUsed = 0;
    var maxColumns = 6; // Using 6-column grid: col-1=1unit, col-2=2units, col-3=6units(full)
    
    formConfig.fields.forEach(function(field, index) {
      var columns = field.columns || 1;
      var isFullWidth = columns === 3 || field.type === 'textarea' || field.type === 'file' || field.type === 'description';
      
      // Calculate column units: col-1=1, col-2=2, col-3(full)=6
      // This allows up to 6 col-1 fields, 3 col-2 fields, or 1 full-width field per row
      var colUnits = isFullWidth ? 6 : (columns === 2 ? 2 : 1);
      
      // Create new row if needed (if full width or won't fit in current row)
      if (!currentRow || isFullWidth || (columnsUsed + colUnits > maxColumns)) {
        currentRow = document.createElement('div');
        currentRow.className = 'kiscience-form-row';
        form.appendChild(currentRow);
        columnsUsed = 0;
      }
      
      var fieldContainer = document.createElement('div');
      var colClass = isFullWidth ? ' full-width' : (columns === 2 ? ' col-2' : (columns === 1 ? ' col-1' : ''));
      fieldContainer.className = 'kiscience-form-field' + colClass;
      
      // Handle description type (just text, no input)
      if (field.type === 'description') {
        var descText = document.createElement('p');
        descText.className = 'kiscience-form-helper';
        descText.innerHTML = field.label;
        fieldContainer.appendChild(descText);
        currentRow.appendChild(fieldContainer);
        columnsUsed += colUnits;
        return;
      }
      
      // Create label
      var label = document.createElement('label');
      label.className = 'kiscience-form-label';
      label.innerHTML = field.label + (field.required ? '<span class="required">*</span>' : '');
      label.setAttribute('for', 'field-' + field.id);
      
      if (field.type !== 'checkbox') {
        fieldContainer.appendChild(label);
      }
      
      var input;
      
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'kiscience-form-textarea';
        input.rows = field.rows || 4;
      } else if (field.type === 'select') {
        input = document.createElement('select');
        input.className = 'kiscience-form-select';
        var defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = field.placeholder || 'Select an option';
        input.appendChild(defaultOption);
        (field.options || []).forEach(function(opt) {
          var option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          input.appendChild(option);
        });
      } else if (field.type === 'checkbox') {
        var checkWrapper = document.createElement('div');
        checkWrapper.className = 'kiscience-form-checkbox-wrapper';
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'kiscience-form-checkbox';
        checkWrapper.appendChild(input);
        checkWrapper.appendChild(label);
        fieldContainer.appendChild(checkWrapper);
      } else if (field.type === 'file') {
        var fileWrapper = document.createElement('div');
        fileWrapper.className = 'kiscience-form-file-wrapper';
        input = document.createElement('input');
        input.type = 'file';
        input.className = 'kiscience-form-file-input';
        input.accept = field.accept || 'image/*,.pdf,.doc,.docx';
        if (field.multiple) input.multiple = true;
        fileWrapper.appendChild(input);
        fieldContainer.appendChild(fileWrapper);
      } else {
        input = document.createElement('input');
        input.className = 'kiscience-form-input';
        input.type = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
      }
      
      input.id = 'field-' + field.id;
      input.name = field.id;
      if (field.required) input.required = true;
      if (field.placeholder && field.type !== 'select') input.placeholder = field.placeholder;
      
      if (field.type !== 'checkbox' && field.type !== 'file') {
        fieldContainer.appendChild(input);
      } else if (field.type === 'file') {
        // Already added above
      }
      
      // Add helper text if exists
      if (field.helperText) {
        var helper = document.createElement('p');
        helper.className = 'kiscience-form-helper';
        helper.innerHTML = field.helperText;
        fieldContainer.appendChild(helper);
      }
      
      currentRow.appendChild(fieldContainer);
      columnsUsed += colUnits;
    });
    
    // Submit button row
    var submitRow = document.createElement('div');
    submitRow.className = 'kiscience-form-row';
    var submitField = document.createElement('div');
    submitField.className = 'kiscience-form-field';
    
    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'kiscience-form-submit';
    submitBtn.textContent = formConfig.settings.submitButtonText || 'SEND';
    submitField.appendChild(submitBtn);
    submitRow.appendChild(submitField);
    form.appendChild(submitRow);
    
    // Message container
    var messageDiv = document.createElement('div');
    messageDiv.id = 'kiscience-message-' + formId;
    messageDiv.className = 'kiscience-form-message';
    form.appendChild(messageDiv);
    
    // ========== VALIDATION HELPERS ==========
    
    function isEmptyOrSpaces(value) {
      return !value || value.trim().length === 0;
    }
    
    function isOnlyZero(value) {
      return value && value.trim() === '0';
    }
    
    function isValidTextInput(value, fieldLabel) {
      var trimmed = value.trim();
      
      // Check if empty
      if (trimmed.length === 0) {
        return { valid: false, error: fieldLabel + ' cannot be empty' };
      }
      
      // Check if only "0"
      if (trimmed === '0') {
        return { valid: false, error: fieldLabel + ' cannot be just "0"' };
      }
      
      // Check if only spaces (already handled above, but extra safety)
      if (trimmed.length === 0) {
        return { valid: false, error: fieldLabel + ' cannot contain only spaces' };
      }
      
      return { valid: true };
    }
    
    function showFieldError(fieldId, errorMessage) {
      var input = document.getElementById('field-' + fieldId);
      if (input) {
        input.classList.add('error');
        // Remove error class on input
        input.addEventListener('input', function() {
          input.classList.remove('error');
        }, { once: true });
      }
    }
    
    function showMessage(message, isError) {
      var msgEl = document.getElementById('kiscience-message-' + formId);
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.className = 'kiscience-form-message ' + (isError ? 'error' : 'success');
        msgEl.textContent = message;
        
        // Auto-hide message after 4 seconds with fade effect
        setTimeout(function() {
          var msgToHide = document.getElementById('kiscience-message-' + formId);
          if (msgToHide) {
            msgToHide.classList.add('fade-out');
            setTimeout(function() {
              var msgToRemove = document.getElementById('kiscience-message-' + formId);
              if (msgToRemove) {
                msgToRemove.style.display = 'none';
                msgToRemove.classList.remove('fade-out');
              }
            }, 500);
          }
        }, 4000);
      }
    }

    // ========== FORM SUBMISSION HANDLER ==========
    
    form.onsubmit = function(e) {
      e.preventDefault();
      
      var validationError = null;
      var errorFieldId = null;
      
      // Validate verification/captcha fields first
      formConfig.fields.forEach(function(field) {
        if (validationError) return; // Skip if already have an error
        
        if (field.correctAnswer) {
          var input = document.getElementById('field-' + field.id);
          if (input) {
            var userAnswer = input.value.trim().toLowerCase();
            var correctAnswer = String(field.correctAnswer).trim().toLowerCase();
            if (userAnswer !== correctAnswer) {
              validationError = field.errorMessage || 'Please provide the correct answer to the verification question.';
              errorFieldId = field.id;
            }
          }
        }
      });
      
      if (validationError) {
        if (errorFieldId) showFieldError(errorFieldId, validationError);
        showMessage(validationError, true);
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      
      // Always use FormData to support file uploads
      var formDataObj = new FormData();
      var hasFiles = false;
      
      console.log('=== KiScience Form Submit Debug ===');
      
      // Validate and collect form data
      formConfig.fields.forEach(function(field) {
        if (validationError) return; // Skip if already have an error
        
        // Skip non-input fields
        if (field.type === 'description') return;

        var input = document.getElementById('field-' + field.id);

        console.log(
          'Field:',
          field.id,
          'Label:',
          field.label,
          'Type:',
          field.type,
          'Input found:',
          !!input
        );

        if (!input) return;

        // ========== VALIDATION FOR TEXT INPUTS ==========
        
        if (field.type === 'text' || field.type === 'textarea') {
          var value = input.value;
          
          // For required fields
          if (field.required) {
            var validation = isValidTextInput(value, field.label);
            if (!validation.valid) {
              validationError = validation.error;
              errorFieldId = field.id;
              return;
            }
          } else {
            // For optional fields, still check if they entered "0" or only spaces
            if (!isEmptyOrSpaces(value)) {
              if (isOnlyZero(value)) {
                validationError = field.label + ' cannot be just "0"';
                errorFieldId = field.id;
                return;
              }
            }
          }
        }
        
        // ========== VALIDATION FOR OTHER REQUIRED FIELDS ==========
        
        if (field.required && field.type !== 'file' && field.type !== 'checkbox') {
          if (field.type !== 'text' && field.type !== 'textarea') {
            // For other input types (email, phone, number, date, select)
            if (isEmptyOrSpaces(input.value)) {
              validationError = field.label + ' is required';
              errorFieldId = field.id;
              return;
            }
          }
        }
        
        // ========== COLLECT VALUES ==========

        if (field.type === 'checkbox') {
          formDataObj.append(field.id, input.checked ? 'true' : 'false');
          console.log('  Checkbox value:', input.checked);

        } else if (field.type === 'file') {
          console.log('  File input files:', input.files ? input.files.length : 0);

          if (input.files && input.files.length > 0) {
            hasFiles = true;
            for (var i = 0; i < input.files.length; i++) {
              console.log(
                '  Adding file:',
                input.files[i].name,
                'Size:',
                input.files[i].size
              );
              formDataObj.append(field.id, input.files[i]);
            }
          } else if (field.required) {
            validationError = field.label + ' is required';
            errorFieldId = field.id;
            return;
          }

        } else {
          // Trim all text values before saving
          var trimmedValue = input.value.trim();
          formDataObj.append(field.id, trimmedValue);
          console.log('  Value:', trimmedValue);
        }
      });
      
      // If there was a validation error, show it and stop
      if (validationError) {
        if (errorFieldId) showFieldError(errorFieldId, validationError);
        showMessage(validationError, true);
        submitBtn.disabled = false;
        submitBtn.textContent = formConfig.settings.submitButtonText || 'SEND';
        return;
      }
      
      // Add metadata
      formDataObj.append('metadata', JSON.stringify({ page: window.location.href }));
      
      console.log('Has files:', hasFiles);
      console.log('Submitting with FormData...');
      console.log('===================================');
      
      // Submit the form
      fetch(apiUrl, {
        method: 'POST',
        body: formDataObj
      })
      .then(function(response) { return response.json(); })
      .then(function(result) {
        if (result.success) {
          showMessage(
            formConfig.settings.successMessage || 'Thank you for your submission!',
            false
          );
          form.reset();
        } else {
          showMessage(
            result.message || result.error || 'Submission failed. Please try again.',
            true
          );
        }
        submitBtn.disabled = false;
        submitBtn.textContent = formConfig.settings.submitButtonText || 'SEND';
      })
      .catch(function(error) {
        console.error('Form submission error:', error);
        showMessage('An error occurred. Please try again.', true);
        submitBtn.disabled = false;
        submitBtn.textContent = formConfig.settings.submitButtonText || 'SEND';
      });
    };
    
    container.appendChild(form);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createForm);
  } else {
    createForm();
  }
  })();
  </script>
  <!-- End KiScience Form Builder -->`
    return script
  }

  const copySourceCode = async (form) => {
    if (form.status !== 'Active') {
      showToast('Please publish the form first to get the embed script', true)
      return
    }
    
    try {
      const script = generateEmbedScript(form)
      await navigator.clipboard.writeText(script)
      showToast('Embed script copied to clipboard')
    } catch (err) {
      showToast('Failed to copy script', true)
    }
  }

  const handleCreateForm = () => {
    navigate('/form-builder/new')
  }

  const handleEditForm = (formId) => {
    navigate(`/form-builder/${formId}`)
  }

  const handleViewSubmissions = (formId) => {
    navigate(`/form-builder/${formId}/submissions`)
  }

  const handleDeleteClick = (form) => {
    setFormToDelete(form)
    setDeleteModalActive(true)
  }

  const handleDeleteConfirm = async () => {
    if (!formToDelete) return

    try {
      setActionLoading('delete')
      await deleteForm(formToDelete.id)
      setForms(forms.filter(f => f.id !== formToDelete.id))
      showToast('Form deleted successfully')
    } catch (err) {
      showToast(err.message || 'Failed to delete form', true)
    } finally {
      setFormToDelete(null)
      setDeleteModalActive(false)
      setActionLoading(null)
    }
  }

  const handleDeleteCancel = () => {
    setFormToDelete(null)
    setDeleteModalActive(false)
  }

  const handleDuplicate = async (formId) => {
    try {
      setActionLoading(formId)
      const response = await duplicateForm(formId)
      setForms([response.form, ...forms])
      showToast('Form duplicated successfully')
    } catch (err) {
      showToast(err.message || 'Failed to duplicate form', true)
    } finally {
      setActionLoading(null)
    }
  }

  const handlePublish = async (formId) => {
    try {
      setActionLoading(formId)
      await updateFormStatus(formId, 'Active')
      setForms(forms.map(f => 
        f.id === formId ? { ...f, status: 'Active' } : f
      ))
      showToast('Form published successfully')
    } catch (err) {
      showToast(err.message || 'Failed to publish form', true)
    } finally {
      setActionLoading(null)
    }
  }

  // const handleExportSubmissions = (formId) => {
  //   const exportUrl = exportSubmissions(formId)
  //   window.open(exportUrl, '_blank')
  // }

  const getStatusBadge = (status) => {
    return status === 'Active' 
      ? <Badge tone="success">{status}</Badge>
      : <Badge tone="info">{status}</Badge>
  }

  // pagination row markup  
  const rowMarkup = paginatedForms.map(
    (form, index) => {
      const { id, name, sourceCode, formId, totalSubmissions, status } = form
      return (
      <IndexTable.Row
        id={id}
        key={id}
        position={index}
      >
        <IndexTable.Cell>
          <Tooltip content={name} active={name.length > 25 ? undefined : false}>
            <Text variant="bodyMd" fontWeight="semibold">
              <span style={{
                display: 'inline-block',
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'middle'
              }}>
                {name}
              </span>
            </Text>
          </Tooltip>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {status === 'Active' ? (
            <Button
              size="slim"
              icon={ClipboardIcon}
              onClick={() => copySourceCode(form)}
            >
              Source Code
            </Button>
          ) : (
            <Text as="span" tone="subdued">Publish first</Text>
          )}
        </IndexTable.Cell>
        {/* <IndexTable.Cell>
          <Button
            size="slim"
            icon={ClipboardIcon}
            onClick={() => copyToClipboard(formId, 'Form ID')}
          >
            Form ID
          </Button>
        </IndexTable.Cell> */}
        <IndexTable.Cell>
          <InlineStack gap="100" blockAlign="center">
            <Button
              variant="plain"
              onClick={() => handleViewSubmissions(id)}
            >
              View submissions
            </Button>
            <Text as="span" tone="subdued">({totalSubmissions || 0})</Text>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {getStatusBadge(status)}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            <Tooltip content="Edit form">
              <Button
                size="slim"
                icon={EditIcon}
                onClick={() => handleEditForm(id)}
                accessibilityLabel={`Edit ${name}`}
              />
            </Tooltip>
            {status !== 'Active' && (
              <Tooltip content="Publish form">
                <Button
                  size="slim"
                  onClick={() => handlePublish(id)}
                  loading={actionLoading === id}
                >
                  Publish
                </Button>
              </Tooltip>
            )}
            <Tooltip content="Duplicate form">
              <Button
                size="slim"
                onClick={() => handleDuplicate(id)}
                loading={actionLoading === id}
              >
                Duplicate
              </Button>
            </Tooltip>
            {/* <Tooltip content="Export submissions">
              <Button
                size="slim"
                icon={ExportIcon}
                onClick={() => handleExportSubmissions(id)}
                disabled={!totalSubmissions}
                accessibilityLabel={`Export ${name} submissions`}
              />
            </Tooltip> */}
            <Tooltip content="Delete form">
              <Button
                size="slim"
                icon={DeleteIcon}
                tone="critical"
                onClick={() => handleDeleteClick({ id, name })}
                accessibilityLabel={`Delete ${name}`}
              />
            </Tooltip>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    )},
  )

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first form"
      action={{ content: 'Create new form', onAction: handleCreateForm }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Build custom forms to collect data from your customers.</p>
    </EmptyState>
  )

  if (loading) {
    return (
      <Frame>
        <NavBar />
        <Page title="Forms">
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
        title="Forms"
        primaryAction={{
          content: 'Create new form',
          icon: PlusIcon,
          onAction: handleCreateForm,
        }}
        secondaryActions={[
          {
            content: 'Refresh',
            icon: RefreshIcon,
            onAction: fetchForms,
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
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
                <Box padding="400">
                  <TextField
                    placeholder="Search forms..."
                    value={searchValue}
                    onChange={handleSearchChange}
                    clearButton
                    onClearButtonClick={handleSearchClear}
                    autoComplete="off"
                    prefix={<Icon source={SearchIcon} />}
                  />
                </Box>
                
                {filteredForms.length === 0 ? (
                  <Box padding="400">
                    {forms.length === 0 ? emptyStateMarkup : (
                      <EmptyState
                        heading="No forms found"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>Try changing your search or filter criteria.</p>
                      </EmptyState>
                    )}
                  </Box>
                ) : (
                  <>
                    <IndexTable
                      resourceName={resourceName}
                      itemCount={paginatedForms.length}
                      selectable={false}
                      headings={[
                        { title: 'Form Name' },
                        { title: 'Copy source code' },
                        // { title: 'Copy ID' },
                        { title: 'Total Submissions' },
                        { title: 'Form Status' },
                        { title: 'Actions' },
                      ]}
                    >
                      {rowMarkup}
                    </IndexTable>
                    
                    <Box padding="400">
                      <BlockStack gap="200">
                        {totalPages > 1 && (
                          <InlineStack align="center" blockAlign="center">
                            <Pagination
                              hasPrevious={currentPage > 1}
                              hasNext={currentPage < totalPages}
                              onPrevious={() => setCurrentPage(currentPage - 1)}
                              onNext={() => setCurrentPage(currentPage + 1)}
                            />
                          </InlineStack>
                        )}
                        <InlineStack align="center" blockAlign="center">
                          <Text as="span" tone="subdued">
                            {startIndex + 1} to {Math.min(endIndex, filteredForms.length)} of {filteredForms.length} forms
                          </Text>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </>
                )}
              </Tabs>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Box paddingBlockStart="400">
              <InlineStack align="center">
                <Text as="p" tone="subdued">
                  ©Copyright 2026 KISCIENCE TECHNOLOGIES PVT. LTD.
                </Text>
              </InlineStack>
            </Box>
          </Layout.Section>
        </Layout>

        {/* Delete Confirmation Modal */}
        <Modal
        limitHeight
          open={deleteModalActive}
          onClose={handleDeleteCancel}
          title="Delete form"
          primaryAction={{
            content: 'Delete',
            destructive: true,
            onAction: handleDeleteConfirm,
            loading: actionLoading === 'delete',
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: handleDeleteCancel,
            },
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <p>
                Are you sure you want to delete "{formToDelete?.name}"? This will also delete all submissions. This action cannot be undone.
              </p>
            </TextContainer>
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

export default FormBuilderPage
