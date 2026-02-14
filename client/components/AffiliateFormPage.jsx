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
  RefreshIcon
} from '@shopify/polaris-icons'
import { useNavigate } from 'react-router-dom'
import {
  getAffiliateForms,
  deleteAffiliateForm
} from '../services/formApi'
import NavBar from './NavBar'

const AffiliateFormPage = ({ shop }) => {
  const navigate = useNavigate()

  // State
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTab, setSelectedTab] = useState(0)
  const [searchValue, setSearchValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState(null)
  const [toastActive, setToastActive] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastError, setToastError] = useState(false)

  const formsPerPage = 8

  useEffect(() => {
    fetchAffiliateForms()
  }, [])

  const fetchAffiliateForms = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getAffiliateForms()
      setForms(response.forms || [])
    } catch (err) {
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
    { id: 'draft', content: 'Draft', badge: forms.filter(f => f.status === 'Draft').length.toString() }
  ]

  const filteredForms = forms.filter(form => {
    const matchesTab =
      selectedTab === 0 ||
      (selectedTab === 1 && form.status === 'Active') ||
      (selectedTab === 2 && form.status === 'Draft')

    const matchesSearch = form.name.toLowerCase().includes(searchValue.toLowerCase())
    return matchesTab && matchesSearch
  })

  const totalPages = Math.ceil(filteredForms.length / formsPerPage)
  const startIndex = (currentPage - 1) * formsPerPage
  const paginatedForms = filteredForms.slice(startIndex, startIndex + formsPerPage)

  const handleDelete = async () => {
    try {
      await deleteAffiliateForm(selectedForm._id)
      showToast('Affiliate form deleted')
      setDeleteModalOpen(false)
      fetchAffiliateForms()
    } catch {
      showToast('Failed to delete form', true)
    }
  }

  // Generate embeddable script for a form
  // const generateEmbedAffiliateScript = (form) => {
  //     // Don't generate script for unpublished forms
  //     if (form.status !== 'Active') {
  //       return `<!-- KiScience Affiliate Form Builder - ${form.name} -->
  // <!-- This form is currently unpublished. Please publish the form to get the embed script. -->`
  //     }
      
  //     const appUrl = window.location.origin
  //     const formId = form._id || form.id // Use MongoDB _id
  //     const script = `<!-- KiScience Affiliate Form Builder - ${form.name} -->
  // <style>
  //   .kiscience-affiliate-form-container {
  //     max-width: 100%;
  //     margin: 0 auto;
  //     font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  //     background: #f8fbfd;
  //     border: 1px solid #e5e7eb; /* light gray border */
  //     border-radius: 12px;
  //     box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  //     padding: 24px;
  //   }
  //   .kiscience-affiliate-form-row {
  //     display: flex;
  //     gap: 20px;
  //     margin-bottom: 20px;
  //     flex-wrap: wrap;
  //   }
  //   .kiscience-affiliate-form-field {
  //     flex: 1;
  //     min-width: 200px;
  //   }
  //   .kiscience-affiliate-form-field.col-1 {
  //     flex: 1 1 calc(33.333% - 14px);
  //     min-width: 150px;
  //   }
  //   .kiscience-affiliate-form-field.col-2 {
  //     flex: 1 1 calc(66.666% - 14px);
  //     min-width: 200px;
  //   }
  //   .kiscience-affiliate-form-field.full-width {
  //     flex: 0 0 100%;
  //     min-width: 100%;
  //     max-width: 100%;
  //   }
  //   .kiscience-affiliate-form-label {
  //     display: block;
  //     margin-bottom: 8px;
  //     font-size: 14px;
  //     color: #333;
  //     font-weight: 500;
  //   }
  //   .kiscience-affiliate-form-label .required {
  //     color: #e53935;
  //   }
  //   .kiscience-affiliate-form-input,
  //   .kiscience-affiliate-form-select,
  //   .kiscience-affiliate-form-textarea {
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
  //   .kiscience-affiliate-form-input:focus,
  //   .kiscience-affiliate-form-select:focus,
  //   .kiscience-affiliate-form-textarea:focus {
  //     outline: none;
  //     border-color: #7db9b3;
  //     box-shadow: 0 0 0 3px rgba(125, 185, 179, 0.1);
  //   }
  //   .kiscience-affiliate-form-input::placeholder,
  //   .kiscience-affiliate-form-textarea::placeholder {
  //     color: #999;
  //   }
  //   .kiscience-affiliate-form-textarea {
  //     min-height: 120px;
  //     resize: vertical;
  //   }
  //   .kiscience-affiliate-form-file-wrapper {
  //     position: relative;
  //   }
  //   .kiscience-affiliate-form-file-input {
  //     width: 100%;
  //     padding: 10px;
  //     border: 1px solid #ddd;
  //     border-radius: 4px;
  //     background: #fff;
  //     cursor: pointer;
  //   }
  //   .kiscience-affiliate-form-checkbox-wrapper {
  //     display: flex;
  //     align-items: flex-start;
  //     gap: 10px;
  //   }
  //   .kiscience-affiliate-form-checkbox {
  //     width: 18px;
  //     height: 18px;
  //     margin-top: 2px;
  //     cursor: pointer;
  //   }
  //   .kiscience-affiliate-form-submit {
  //     width: 100%;
  //     background-color: #2B7BE5;
  //     color: #ffffff;
  //     padding: 14px 20px;
  //     border: none;
  //     border-radius: 6px;
  //     font-size: 16px;
  //     font-weight: 600;
  //     cursor: pointer;
  //     text-transform: uppercase;
  //     letter-spacing: 0.5px;
  //     transition: background-color 0.2s ease;
  //   }

  //   .kiscience-affiliate-form-submit:hover {
  //     background-color: #1f63c0;
  //   }

  //   .kiscience-affiliate-form-submit:disabled {
  //     background-color: #9bbcf2;
  //     cursor: not-allowed;
  //   }

  //   .kiscience-affiliate-form-message {
  //     margin-top: 20px;
  //     padding: 15px;
  //     border-radius: 4px;
  //     text-align: center;
  //     display: none;
  //   }
  //   .kiscience-affiliate-form-message.success {
  //     background-color: #d4edda;
  //     color: #155724;
  //     border: 1px solid #c3e6cb;
  //   }
  //   .kiscience-affiliate-form-message.error {
  //     background-color: #f8d7da;
  //     color: #721c24;
  //     border: 1px solid #f5c6cb;
  //   }
  //   .kiscience-affiliate-form-message.fade-out {
  //     opacity: 0;
  //     transition: opacity 0.5s ease-out;
  //   }
  //   @media (max-width: 600px) {
  //     .kiscience-affiliate-form-row {
  //       flex-direction: column;
  //     }
  //     .kiscience-affiliate-form-field,
  //     .kiscience-affiliate-form-field.col-1,
  //     .kiscience-affiliate-form-field.col-2 {
  //       flex: 0 0 100%;
  //       max-width: 100%;
  //       min-width: 100%;
  //     }
  //   }

  //   .kiscience-link {
  //     color: #2B7BE5;
  //     font-weight: 500;
  //     text-decoration: none;
  //     transition: color 0.2s ease;
  //   }

  //   .kiscience-link:hover {
  //     color: #1f63c0;
  //     text-decoration: underline;
  //   }

  // </style>
  // <div id="kiscience-affiliate-form-${formId}" class="kiscience-affiliate-form-container"></div>
  // <script>
  // (function() {
  //   var formId = "${formId}";
  //   var containerId = "kiscience-affiliate-form-${formId}";
  //   var apiUrl = "${appUrl}/api/affiliate-forms/" + formId + "/submit";
    
  //   var formConfig = ${JSON.stringify({
  //     name: form.name,
  //     description: form.description,
  //     fields: form.fields || [],
  //     settings: form.settings || {}
  //   })};
    
  //   function autoFillFromShopifyCustomer(formEl) {
  //     if (!window.KISCENCE_CUSTOMER || !formEl) return;

  //     var customer = window.KISCENCE_CUSTOMER;

  //     console.log('🟢 Autofill attempt with:', customer);

  //     var inputs = formEl.querySelectorAll('input, textarea');

  //     inputs.forEach(function (input) {
  //       var label = '';
  //       var labelEl = formEl.querySelector('label[for="' + input.id + '"]');
  //       if (labelEl) label = labelEl.innerText.toLowerCase();

  //       var name = (input.name || '').toLowerCase();
  //       var placeholder = (input.placeholder || '').toLowerCase();

  //       // EMAIL
  //       if (
  //         customer.email &&
  //         (label.includes('email') || name.includes('email') || placeholder.includes('email'))
  //       ) {
  //         input.value = customer.email;
  //       }

  //       // FIRST NAME
  //       if (
  //         customer.first_name &&
  //         (label.includes('first') || label.includes('name') && !label.includes('last'))
  //       ) {
  //         input.value = customer.first_name;
  //       }

  //       // LAST NAME
  //       if (
  //         customer.last_name &&
  //         label.includes('last')
  //       ) {
  //         input.value = customer.last_name;
  //       }

  //       // PHONE
  //       if (
  //         customer.phone &&
  //         (label.includes('phone') || name.includes('phone'))
  //       ) {
  //         input.value = customer.phone;
  //       }

  //       // // Optional: lock autofilled fields
  //       // if (input.value) {
  //       //   input.readOnly = true;
  //       //   input.style.backgroundColor = '#f3f4f6';
  //       // }
  //     });
  //   }

      
  //   function createForm() {
  //     var container = document.getElementById(containerId);
  //     if (!container) {
  //       console.error('Affiliate form container not found:', containerId);
  //       return;
  //     }
      
  //     var form = document.createElement('form');
  //     form.id = 'kiscience-affiliate-form-element-' + formId;
  //     form.className = 'kiscience-affiliate-form';

  //       // ==== ADD FORM TITLE AT THE TOP ====
  //       var titleEl = document.createElement('h2');
  //       titleEl.textContent = formConfig.name;
  //       titleEl.style.textAlign = 'center';
  //       titleEl.style.marginBottom = '10px';
  //       titleEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  //       titleEl.style.color = '#333';
  //       titleEl.style.fontSize = '24px';
  //       titleEl.style.fontWeight = '600';
  //       titleEl.style.marginTop = '0px';
  //       form.appendChild(titleEl);
  //       // ==== END TITLE ====


  //       // ==== ADD FORM DESCRIPTION UNDER TITLE ====
  //       if (formConfig.description && formConfig.description.trim() !== '') {
  //         var descEl = document.createElement('p');
  //         descEl.textContent = formConfig.description;
  //         descEl.style.textAlign = 'center';
  //         descEl.style.marginTop = '0px';
  //         descEl.style.marginBottom = '20px';
  //         descEl.style.fontSize = '14px';
  //         descEl.style.color = '#555';
  //         descEl.style.lineHeight = '1.5';
  //         form.appendChild(descEl);
  //       }
  //       // ==== END DESCRIPTION ====

  //     // ==== ADD SHOPIFY ACCOUNT LINK ====
  //     var shopifyLinkEl = document.createElement('div');
  //     shopifyLinkEl.style.textAlign = 'right';
  //     shopifyLinkEl.style.marginBottom = '20px';

  //     var shopifyLink = document.createElement('a');
  //     shopifyLink.href = window.location.origin + '/account'; // Dynamic shop account link
  //     shopifyLink.target = '_blank';
  //     shopifyLink.textContent = 'Already have an account? Log in!';
  //     shopifyLink.style.color = '#2B7BE5';
  //     shopifyLink.style.fontSize = '14px';
  //     shopifyLink.style.fontWeight = '500';
  //     shopifyLink.style.textDecoration = 'none';

  //     shopifyLink.onmouseover = () => shopifyLink.style.textDecoration = 'underline';
  //     shopifyLink.onmouseout = () => shopifyLink.style.textDecoration = 'none';

  //     shopifyLinkEl.appendChild(shopifyLink);
  //     form.appendChild(shopifyLinkEl);
  //     // ==== END SHOPIFY ACCOUNT LINK ====
      
  //     // Group fields into rows based on column settings
  //     var currentRow = null;
  //     var columnsUsed = 0;
  //     var maxColumns = 3; // 3-column grid
      
  //     formConfig.fields.forEach(function(field) {
  //       var columns = parseInt(field.columns) || 1;
  //       var isFullWidth = columns === 3 || field.type === 'textarea' || field.type === 'file';
        
  //       // Create new row if needed
  //       if (!currentRow || isFullWidth || (columnsUsed + columns > maxColumns)) {
  //         currentRow = document.createElement('div');
  //         currentRow.className = 'kiscience-affiliate-form-row';
  //         form.appendChild(currentRow);
  //         columnsUsed = 0;
  //       }
        
  //       var fieldContainer = document.createElement('div');
  //       var colClass = isFullWidth ? ' full-width' : (columns === 2 ? ' col-2' : ' col-1');
  //       fieldContainer.className = 'kiscience-affiliate-form-field' + colClass;
        
  //       // Create label
  //       var label = document.createElement('label');
  //       label.className = 'kiscience-affiliate-form-label';
  //       label.innerHTML = field.label + (field.required ? ' <span class="required">*</span>' : '');
  //       label.setAttribute('for', 'affiliate-field-' + field.id);
        
  //       if (field.type !== 'checkbox') {
  //         fieldContainer.appendChild(label);
  //       }
        
  //       var input;
        
  //       // Create input based on field type
  //       if (field.type === 'textarea') {
  //         input = document.createElement('textarea');
  //         input.className = 'kiscience-affiliate-form-textarea';
  //         input.rows = 4;
  //       } else if (field.type === 'select') {
  //         input = document.createElement('select');
  //         input.className = 'kiscience-affiliate-form-select';
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
  //         checkWrapper.className = 'kiscience-affiliate-form-checkbox-wrapper';
  //         input = document.createElement('input');
  //         input.type = 'checkbox';
  //         input.className = 'kiscience-affiliate-form-checkbox';
  //         checkWrapper.appendChild(input);
  //         checkWrapper.appendChild(label);
  //         fieldContainer.appendChild(checkWrapper);
  //       } else if (field.type === 'file') {
  //         var fileWrapper = document.createElement('div');
  //         fileWrapper.className = 'kiscience-affiliate-form-file-wrapper';
  //         input = document.createElement('input');
  //         input.type = 'file';
  //         input.className = 'kiscience-affiliate-form-file-input';
  //         input.accept = field.accept || 'image/*,.pdf,.doc,.docx';
  //         fileWrapper.appendChild(input);
  //         fieldContainer.appendChild(fileWrapper);
  //       } else {
  //         input = document.createElement('input');
  //         input.className = 'kiscience-affiliate-form-input';
  //         input.type = field.type === 'email' ? 'email' : 
  //                      field.type === 'phone' ? 'tel' : 
  //                      field.type === 'number' ? 'number' : 
  //                      field.type === 'date' ? 'date' : 'text';
  //       }
        
  //       input.id = 'affiliate-field-' + field.id;
  //       input.name = field.id;
  //       if (field.required) input.required = true;
  //       if (field.placeholder && field.type !== 'select') input.placeholder = field.placeholder;
        
  //       if (field.type !== 'checkbox' && field.type !== 'file') {
  //         fieldContainer.appendChild(input);
  //       }
        
  //       currentRow.appendChild(fieldContainer);
  //       columnsUsed += columns;
  //     });
      
  //     // Submit button row
  //     var submitRow = document.createElement('div');
  //     submitRow.className = 'kiscience-affiliate-form-row';
  //     var submitField = document.createElement('div');
  //     submitField.className = 'kiscience-affiliate-form-field full-width';


  //     // ==== ADD TERMS & PRIVACY CHECKBOXES ====
  //     var termsRow = document.createElement('div');
  //     termsRow.className = 'kiscience-affiliate-form-row';

  //     var termsField = document.createElement('div');
  //     termsField.className = 'kiscience-affiliate-form-field full-width';

  //     var termsHtml =
  //       '<div style="font-size:13px; margin-bottom:5px;">' +
  //         '<input type="checkbox" id="tos1" required> ' +
  //         'I accept the <a class="kiscience-link" href="https://s2.kiscience.com/af-1072270/affiliate.panel?mode=tos_text" target="_blank">' +
  //           'Terms of Use and Privacy policy of this Affiliate program' +
  //         '</a>' +
  //       '</div>' +
  //       '<div style="font-size:13px;">' +
  //         '<input type="checkbox" id="tos2" required> ' +
  //         'I accept the <a class="kiscience-link" href="https://www.kiscience.com/legal-tos" target="_blank">Terms of Service</a> ' +
  //         'and <a class="kiscience-link" href="https://www.kiscience.com/legal-privacy" target="_blank">Privacy policy of kiscience.com</a>' +
  //       '</div>';


  //     termsField.innerHTML = termsHtml;
  //     termsRow.appendChild(termsField);
  //     form.appendChild(termsRow);
  //     // ==== END TERMS & PRIVACY CHECKBOXES ====

      
  //     var submitBtn = document.createElement('button');
  //     submitBtn.type = 'submit';
  //     submitBtn.className = 'kiscience-affiliate-form-submit';
  //     submitBtn.textContent = 'Register';
  //     submitField.appendChild(submitBtn);
  //     submitRow.appendChild(submitField);
  //     form.appendChild(submitRow);
      
  //     // Message container
  //     var messageDiv = document.createElement('div');
  //     messageDiv.id = 'kiscience-affiliate-message-' + formId;
  //     messageDiv.className = 'kiscience-affiliate-form-message';
  //     form.appendChild(messageDiv);
      
  //     // autofillFromShopifyCustomer();

  //     // Form submission handler
  //     form.onsubmit = function(e) {
  //       e.preventDefault();
        
  //       submitBtn.disabled = true;
  //       submitBtn.textContent = 'Sending...';
        
  //       var formDataObj = new FormData();
        
  //       formConfig.fields.forEach(function(field) {
  //         var input = document.getElementById('affiliate-field-' + field.id);
  //         if (!input) return;
          
  //         if (field.type === 'checkbox') {
  //           formDataObj.append(field.id, input.checked ? 'true' : 'false');
  //         } else if (field.type === 'file') {
  //           if (input.files && input.files.length > 0) {
  //             for (var i = 0; i < input.files.length; i++) {
  //               formDataObj.append(field.id, input.files[i]);
  //             }
  //           }
  //         } else {
  //           formDataObj.append(field.id, input.value.trim());
  //         }
  //       });
        
  //       // Add metadata
  //       formDataObj.append('metadata', JSON.stringify({ 
  //         page: window.location.href,
  //         timestamp: new Date().toISOString()
  //       }));
        
  //       fetch(apiUrl, {
  //         method: 'POST',
  //         body: formDataObj
  //       })
  //       .then(function(response) { return response.json(); })
  //       .then(function(result) {
  //         var msgEl = document.getElementById('kiscience-affiliate-message-' + formId);
  //         if (msgEl) {
  //           msgEl.style.display = 'block';
  //           msgEl.className = 'kiscience-affiliate-form-message ' + (result.success ? 'success' : 'error');
  //           msgEl.textContent = result.success 
  //             ? (result.message || 'Thank you for your affiliate registration!')
  //             : (result.error || 'Submission failed. Please try again.');
            
  //           setTimeout(function() {
  //             msgEl.classList.add('fade-out');
  //             setTimeout(function() {
  //               msgEl.style.display = 'none';
  //               msgEl.classList.remove('fade-out');
  //             }, 500);
  //           }, 4000);
  //         }
  //         if (result.success) form.reset();
  //         submitBtn.disabled = false;
  //         submitBtn.textContent = 'SUBMIT';
  //       })
  //       .catch(function(error) {
  //         var msgEl = document.getElementById('kiscience-affiliate-message-' + formId);
  //         if (msgEl) {
  //           msgEl.style.display = 'block';
  //           msgEl.className = 'kiscience-affiliate-form-message error';
  //           msgEl.textContent = 'An error occurred. Please try again.';
            
  //           setTimeout(function() {
  //             msgEl.classList.add('fade-out');
  //             setTimeout(function() {
  //               msgEl.style.display = 'none';
  //               msgEl.classList.remove('fade-out');
  //             }, 500);
  //           }, 4000);
  //         }
  //         submitBtn.disabled = false;
  //         submitBtn.textContent = 'SUBMIT';
  //       });
  //     };
      
  //     container.appendChild(form);
  //     // ⏳ Delay autofill to ensure DOM is ready
  //     setTimeout(function () {
  //       autoFillFromShopifyCustomer(form);
  //     }, 50);
  //   }
    
  //   if (document.readyState === 'loading') {
  //     document.addEventListener('DOMContentLoaded', createForm);
  //   } else {
  //     createForm();
  //   }
  // })();
  // </script>
  // <!-- End KiScience Affiliate Form Builder -->`
  //     return script
  // }
  const generateEmbedAffiliateScript = (form) => {
    // Don't generate script for unpublished forms
    if (form.status !== 'Active') {
      return `<!-- KiScience Affiliate Form Builder - ${form.name} -->
<!-- This form is currently unpublished. Please publish the form to get the embed script. -->`
    }
    
    const appUrl = window.location.origin
    const formId = form._id || form.id // Use MongoDB _id
    const script = `<!-- KiScience Affiliate Form Builder - ${form.name} -->
<style>
  .kiscience-affiliate-form-container {
    max-width: 100%;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f8fbfd;
    border: 1px solid #e5e7eb; /* light gray border */
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    padding: 24px;
  }
  .kiscience-affiliate-form-row {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .kiscience-affiliate-form-field {
    flex: 1;
    min-width: 200px;
  }
  .kiscience-affiliate-form-field.col-1 {
    flex: 1 1 calc(33.333% - 14px);
    min-width: 150px;
  }
  .kiscience-affiliate-form-field.col-2 {
    flex: 1 1 calc(66.666% - 14px);
    min-width: 200px;
  }
  .kiscience-affiliate-form-field.full-width {
    flex: 0 0 100%;
    min-width: 100%;
    max-width: 100%;
  }
  .kiscience-affiliate-form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }
  .kiscience-affiliate-form-label .required {
    color: #e53935;
  }
  .kiscience-affiliate-form-input,
  .kiscience-affiliate-form-select,
  .kiscience-affiliate-form-textarea {
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
  .kiscience-affiliate-form-input:focus,
  .kiscience-affiliate-form-select:focus,
  .kiscience-affiliate-form-textarea:focus {
    outline: none;
    border-color: #7db9b3;
    box-shadow: 0 0 0 3px rgba(125, 185, 179, 0.1);
  }
  .kiscience-affiliate-form-input::placeholder,
  .kiscience-affiliate-form-textarea::placeholder {
    color: #999;
  }
  .kiscience-affiliate-form-textarea {
    min-height: 120px;
    resize: vertical;
  }
  .kiscience-affiliate-form-file-wrapper {
    position: relative;
  }
  .kiscience-affiliate-form-file-input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
  .kiscience-affiliate-form-checkbox-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .kiscience-affiliate-form-checkbox {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    cursor: pointer;
  }
  .kiscience-affiliate-form-submit {
    width: 100%;
    background-color: #2B7BE5;
    color: #ffffff;
    padding: 14px 20px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: background-color 0.2s ease;
  }

  .kiscience-affiliate-form-submit:hover {
    background-color: #1f63c0;
  }

  .kiscience-affiliate-form-submit:disabled {
    background-color: #9bbcf2;
    cursor: not-allowed;
  }

  .kiscience-affiliate-form-message {
    margin-top: 20px;
    padding: 15px;
    border-radius: 4px;
    text-align: center;
    display: none;
  }
  .kiscience-affiliate-form-message.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }
  .kiscience-affiliate-form-message.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }
  .kiscience-affiliate-form-message.fade-out {
    opacity: 0;
    transition: opacity 0.5s ease-out;
  }
  .kiscience-affiliate-form-input.error,
  .kiscience-affiliate-form-select.error,
  .kiscience-affiliate-form-textarea.error {
    border-color: #e53935;
  }
  @media (max-width: 600px) {
    .kiscience-affiliate-form-row {
      flex-direction: column;
    }
    .kiscience-affiliate-form-field,
    .kiscience-affiliate-form-field.col-1,
    .kiscience-affiliate-form-field.col-2 {
      flex: 0 0 100%;
      max-width: 100%;
      min-width: 100%;
    }
  }

  .kiscience-link {
    color: #2B7BE5;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .kiscience-link:hover {
    color: #1f63c0;
    text-decoration: underline;
  }

</style>
<div id="kiscience-affiliate-form-${formId}" class="kiscience-affiliate-form-container"></div>
<script>
(function() {
  var formId = "${formId}";
  var containerId = "kiscience-affiliate-form-${formId}";
  var apiUrl = "${appUrl}/api/affiliate-forms/" + formId + "/submit";
  
  var formConfig = ${JSON.stringify({
    name: form.name,
    description: form.description,
    fields: form.fields || [],
    settings: form.settings || {}
  })};
  
  function autoFillFromShopifyCustomer(formEl) {
    if (!window.KISCENCE_CUSTOMER || !formEl) return;

    var customer = window.KISCENCE_CUSTOMER;

    console.log('🟢 Autofill attempt with:', customer);

    var inputs = formEl.querySelectorAll('input, textarea');

    inputs.forEach(function (input) {
      var label = '';
      var labelEl = formEl.querySelector('label[for="' + input.id + '"]');
      if (labelEl) label = labelEl.innerText.toLowerCase();

      var name = (input.name || '').toLowerCase();
      var placeholder = (input.placeholder || '').toLowerCase();
      
      var shouldLockField = false;

      // EMAIL - Lock this field (but NOT payment email or any field with "payment" in label)
      if (
        customer.email &&
        !label.includes('payment') &&
        (label.includes('email') || name.includes('email') || placeholder.includes('email'))
      ) {
        input.value = customer.email;
        shouldLockField = true;
      }

      // FIRST NAME - Lock this field
      if (
        customer.first_name &&
        (label.includes('first') || (label.includes('name') && !label.includes('last')))
      ) {
        input.value = customer.first_name;
        shouldLockField = true;
      }

      // LAST NAME - Lock this field
      if (
        customer.last_name &&
        label.includes('last')
      ) {
        input.value = customer.last_name;
        shouldLockField = true;
      }

      // PHONE - Keep this editable (don't lock)
      if (
        customer.phone &&
        (label.includes('phone') || name.includes('phone'))
      ) {
        input.value = customer.phone;
        // shouldLockField remains false - phone is editable
      }

      // Lock fields that should not be editable
      if (shouldLockField) {
        input.readOnly = true;
        input.style.backgroundColor = '#f3f4f6';
        input.style.cursor = 'not-allowed';
      }
    });
  }

    
  function createForm() {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('Affiliate form container not found:', containerId);
      return;
    }
    
    var form = document.createElement('form');
    form.id = 'kiscience-affiliate-form-element-' + formId;
    form.className = 'kiscience-affiliate-form';

      // ==== ADD FORM TITLE AT THE TOP ====
      var titleEl = document.createElement('h2');
      titleEl.textContent = formConfig.name;
      titleEl.style.textAlign = 'center';
      titleEl.style.marginBottom = '10px';
      titleEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      titleEl.style.color = '#333';
      titleEl.style.fontSize = '24px';
      titleEl.style.fontWeight = '600';
      titleEl.style.marginTop = '0px';
      form.appendChild(titleEl);
      // ==== END TITLE ====


      // ==== ADD FORM DESCRIPTION UNDER TITLE ====
      if (formConfig.description && formConfig.description.trim() !== '') {
        var descEl = document.createElement('p');
        descEl.textContent = formConfig.description;
        descEl.style.textAlign = 'center';
        descEl.style.marginTop = '0px';
        descEl.style.marginBottom = '20px';
        descEl.style.fontSize = '14px';
        descEl.style.color = '#555';
        descEl.style.lineHeight = '1.5';
        form.appendChild(descEl);
      }
      // ==== END DESCRIPTION ====

    // ==== ADD SHOPIFY ACCOUNT LINK ====
    var shopifyLinkEl = document.createElement('div');
    shopifyLinkEl.style.textAlign = 'right';
    shopifyLinkEl.style.marginBottom = '20px';

    var shopifyLink = document.createElement('a');
    shopifyLink.href = window.location.origin + '/account'; // Dynamic shop account link
    shopifyLink.target = '_blank';
    shopifyLink.textContent = 'Already have an account? Log in!';
    shopifyLink.style.color = '#2B7BE5';
    shopifyLink.style.fontSize = '14px';
    shopifyLink.style.fontWeight = '500';
    shopifyLink.style.textDecoration = 'none';

    shopifyLink.onmouseover = () => shopifyLink.style.textDecoration = 'underline';
    shopifyLink.onmouseout = () => shopifyLink.style.textDecoration = 'none';

    shopifyLinkEl.appendChild(shopifyLink);
    form.appendChild(shopifyLinkEl);
    // ==== END SHOPIFY ACCOUNT LINK ====
    
    // Group fields into rows based on column settings
    var currentRow = null;
    var columnsUsed = 0;
    var maxColumns = 3; // 3-column grid
    
    formConfig.fields.forEach(function(field) {
      var columns = parseInt(field.columns) || 1;
      var isFullWidth = columns === 3 || field.type === 'textarea' || field.type === 'file';
      
      // Create new row if needed
      if (!currentRow || isFullWidth || (columnsUsed + columns > maxColumns)) {
        currentRow = document.createElement('div');
        currentRow.className = 'kiscience-affiliate-form-row';
        form.appendChild(currentRow);
        columnsUsed = 0;
      }
      
      var fieldContainer = document.createElement('div');
      var colClass = isFullWidth ? ' full-width' : (columns === 2 ? ' col-2' : ' col-1');
      fieldContainer.className = 'kiscience-affiliate-form-field' + colClass;
      
      // Create label
      var label = document.createElement('label');
      label.className = 'kiscience-affiliate-form-label';
      label.innerHTML = field.label + (field.required ? ' <span class="required">*</span>' : '');
      label.setAttribute('for', 'affiliate-field-' + field.id);
      
      if (field.type !== 'checkbox') {
        fieldContainer.appendChild(label);
      }
      
      var input;
      
      // Create input based on field type
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'kiscience-affiliate-form-textarea';
        input.rows = 4;
      } else if (field.type === 'select') {
        input = document.createElement('select');
        input.className = 'kiscience-affiliate-form-select';
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
        checkWrapper.className = 'kiscience-affiliate-form-checkbox-wrapper';
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'kiscience-affiliate-form-checkbox';
        checkWrapper.appendChild(input);
        checkWrapper.appendChild(label);
        fieldContainer.appendChild(checkWrapper);
      } else if (field.type === 'file') {
        var fileWrapper = document.createElement('div');
        fileWrapper.className = 'kiscience-affiliate-form-file-wrapper';
        input = document.createElement('input');
        input.type = 'file';
        input.className = 'kiscience-affiliate-form-file-input';
        input.accept = field.accept || 'image/*,.pdf,.doc,.docx';
        fileWrapper.appendChild(input);
        fieldContainer.appendChild(fileWrapper);
      } else {
        input = document.createElement('input');
        input.className = 'kiscience-affiliate-form-input';
        input.type = field.type === 'email' ? 'email' : 
                     field.type === 'phone' ? 'tel' : 
                     field.type === 'number' ? 'number' : 
                     field.type === 'date' ? 'date' : 'text';
      }
      
      input.id = 'affiliate-field-' + field.id;
      input.name = field.id;
      if (field.placeholder && field.type !== 'select') input.placeholder = field.placeholder;
      
      if (field.type !== 'checkbox' && field.type !== 'file') {
        fieldContainer.appendChild(input);
      }
      
      currentRow.appendChild(fieldContainer);
      columnsUsed += columns;
    });
    
    // Submit button row
    var submitRow = document.createElement('div');
    submitRow.className = 'kiscience-affiliate-form-row';
    var submitField = document.createElement('div');
    submitField.className = 'kiscience-affiliate-form-field full-width';


    // ==== ADD TERMS & PRIVACY CHECKBOXES ====
    var termsRow = document.createElement('div');
    termsRow.className = 'kiscience-affiliate-form-row';

    var termsField = document.createElement('div');
    termsField.className = 'kiscience-affiliate-form-field full-width';

    var termsHtml =
      '<div style="font-size:13px; margin-bottom:5px;">' +
        '<input type="checkbox" id="tos1"> ' +
        'I accept the <a class="kiscience-link" href="https://s2.kiscience.com/af-1072270/affiliate.panel?mode=tos_text" target="_blank">' +
          'Terms of Use and Privacy policy of this Affiliate program' +
        '</a>' +
      '</div>' +
      '<div style="font-size:13px;">' +
        '<input type="checkbox" id="tos2"> ' +
        'I accept the <a class="kiscience-link" href="https://kiscience.myshopify.com/pages/website-terms-conditions" target="_blank">Terms of Service</a> ' +
        'and <a class="kiscience-link" href="https://kiscience.myshopify.com/pages/privacy-policy" target="_blank">Privacy policy of kiscience.com</a>' +
      '</div>';


    termsField.innerHTML = termsHtml;
    termsRow.appendChild(termsField);
    form.appendChild(termsRow);
    // ==== END TERMS & PRIVACY CHECKBOXES ====

    
    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'kiscience-affiliate-form-submit';
    submitBtn.textContent = 'Register';
    submitField.appendChild(submitBtn);
    submitRow.appendChild(submitField);
    form.appendChild(submitRow);
    
    // Message container
    var messageDiv = document.createElement('div');
    messageDiv.id = 'kiscience-affiliate-message-' + formId;
    messageDiv.className = 'kiscience-affiliate-form-message';
    form.appendChild(messageDiv);
    
    // ========== VALIDATION HELPERS ==========
    function isEmptyOrSpaces(value) {
      return !value || (typeof value === 'string' && value.trim().length === 0);
    }
    function isValidTextInput(value, fieldLabel) {
      var trimmed = (value || '').trim();
      if (trimmed.length === 0) return { valid: false, error: fieldLabel + ' cannot be empty' };
      if (trimmed === '0') return { valid: false, error: fieldLabel + ' cannot be just "0"' };
      return { valid: true };
    }
    function showFieldError(fieldId, errorMessage) {
      var input = document.getElementById('affiliate-field-' + fieldId);
      if (input) {
        input.classList.add('error');
        input.addEventListener('input', function() { input.classList.remove('error'); }, { once: true });
        input.addEventListener('change', function() { input.classList.remove('error'); }, { once: true });
      }
    }
    function showMessage(message, isError) {
      var msgEl = document.getElementById('kiscience-affiliate-message-' + formId);
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.className = 'kiscience-affiliate-form-message ' + (isError ? 'error' : 'success');
        msgEl.textContent = message;
        setTimeout(function() {
          var m = document.getElementById('kiscience-affiliate-message-' + formId);
          if (m) {
            m.classList.add('fade-out');
            setTimeout(function() {
              var m2 = document.getElementById('kiscience-affiliate-message-' + formId);
              if (m2) { m2.style.display = 'none'; m2.classList.remove('fade-out'); }
            }, 500);
          }
        }, 4000);
      }
    }
    // ========== END VALIDATION HELPERS ==========

    // Form submission handler
    form.onsubmit = function(e) {
      e.preventDefault();
      
      var validationError = null;
      var errorFieldId = null;
      var allInputs = form.querySelectorAll('.kiscience-affiliate-form-input, .kiscience-affiliate-form-select, .kiscience-affiliate-form-textarea, .kiscience-affiliate-form-file-input');
      allInputs.forEach(function(inp) { inp.classList.remove('error'); });
      var msgElToClear = document.getElementById('kiscience-affiliate-message-' + formId);
      if (msgElToClear) msgElToClear.style.display = 'none';
      
      formConfig.fields.forEach(function(field) {
        if (validationError) return;
        var input = document.getElementById('affiliate-field-' + field.id);
        if (!input) return;
        if (field.required) {
          if (field.type === 'checkbox') {
            if (!input.checked) { validationError = field.label + ' is required'; errorFieldId = field.id; }
          } else if (field.type === 'file') {
            if (!input.files || input.files.length === 0) { validationError = field.label + ' is required'; errorFieldId = field.id; }
          } else if (field.type === 'text' || field.type === 'textarea') {
            var v = isValidTextInput(input.value, field.label);
            if (!v.valid) { validationError = v.error; errorFieldId = field.id; }
          } else {
            if (isEmptyOrSpaces(input.value)) { validationError = field.label + ' is required'; errorFieldId = field.id; }
          }
        }
      });
      
      var tos1 = document.getElementById('tos1');
      var tos2 = document.getElementById('tos2');
      if (!validationError && tos1 && !tos1.checked) validationError = 'You must accept the Terms of Use and Privacy policy of this Affiliate program.';
      if (!validationError && tos2 && !tos2.checked) validationError = 'You must accept the Terms of Service and Privacy policy of kiscience.com.';
      
      if (validationError) {
        if (errorFieldId) showFieldError(errorFieldId, validationError);
        showMessage(validationError, true);
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      
      var formDataObj = new FormData();
      formConfig.fields.forEach(function(field) {
        var input = document.getElementById('affiliate-field-' + field.id);
        if (!input) return;
        if (field.type === 'checkbox') {
          formDataObj.append(field.id, input.checked ? 'true' : 'false');
        } else if (field.type === 'file') {
          if (input.files && input.files.length > 0) {
            for (var i = 0; i < input.files.length; i++) formDataObj.append(field.id, input.files[i]);
          }
        } else {
          formDataObj.append(field.id, (input.value || '').trim());
        }
      });
      formDataObj.append('metadata', JSON.stringify({ page: window.location.href, timestamp: new Date().toISOString() }));
      
      fetch(apiUrl, { method: 'POST', body: formDataObj })
      .then(function(response) { return response.json(); })
      .then(function(result) {
        var msgEl = document.getElementById('kiscience-affiliate-message-' + formId);
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.className = 'kiscience-affiliate-form-message ' + (result.success ? 'success' : 'error');
          msgEl.textContent = result.success ? (result.message || 'Thank you for your affiliate registration!') : (result.error || 'Submission failed. Please try again.');
          setTimeout(function() {
            var m = document.getElementById('kiscience-affiliate-message-' + formId);
            if (m) { m.classList.add('fade-out'); setTimeout(function() { var m2 = document.getElementById('kiscience-affiliate-message-' + formId); if (m2) { m2.style.display = 'none'; m2.classList.remove('fade-out'); } }, 500); }
          }, 4000);
        }
        if (result.success) form.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
      })
      .catch(function(error) {
        var msgEl = document.getElementById('kiscience-affiliate-message-' + formId);
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.className = 'kiscience-affiliate-form-message error';
          msgEl.textContent = 'An error occurred. Please try again.';
          setTimeout(function() {
            var m = document.getElementById('kiscience-affiliate-message-' + formId);
            if (m) {
              m.classList.add('fade-out');
              setTimeout(function() {
                var m2 = document.getElementById('kiscience-affiliate-message-' + formId);
                if (m2) { m2.style.display = 'none'; m2.classList.remove('fade-out'); }
              }, 500);
            }
          }, 4000);
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
      });
    };
    
    container.appendChild(form);
    // ⏳ Delay autofill to ensure DOM is ready
    setTimeout(function () {
      autoFillFromShopifyCustomer(form);
    }, 50);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createForm);
  } else {
    createForm();
  }
})();
</script>
<!-- End KiScience Affiliate Form Builder -->`
    return script
  }

  const copySourceCode = async (form) => {
    if (form.status !== 'Active') {
      showToast('Please publish the affiliate form first to get the embed script', true)
      return
    }
    
    try {
      const script = generateEmbedAffiliateScript(form)
      await navigator.clipboard.writeText(script)
      showToast('Affiliate form embed script copied to clipboard')
    } catch (err) {
      showToast('Failed to copy affiliate form embed script', true)
    }
  }

  const rowMarkup = paginatedForms.map((form, index) => (
    <IndexTable.Row key={form._id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text as="p" fontWeight="medium">{form.name}</Text>
        </BlockStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Button
            size="slim"
            icon={ClipboardIcon}
            onClick={() => copySourceCode(form)}
        >
            Source Code
        </Button>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="p" tone="subdued">{form.fields?.length || 0} fields</Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
      <InlineStack gap="100" blockAlign="center">
          <Button
              variant="plain"
              onClick={() => navigate(`/affiliate-form/${form._id}/submissions`)}
            >
              View submissions
            </Button>
            <Text as="span" tone="subdued">({form.totalSubmissions || 0})</Text>
        </InlineStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Badge tone={form.status === 'Active' ? 'success' : 'warning'}>
          {form.status}
        </Badge>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <InlineStack gap="200">
          <Tooltip content="Edit form">
            <Button
              size="slim"
              icon={EditIcon}
              onClick={() => navigate(`/affiliate-form/${form._id}`)}
            />
          </Tooltip>

          <Tooltip content="Delete">
            <Button
              size="slim"
              icon={DeleteIcon}
              tone="critical"
              onClick={() => {
                setSelectedForm(form)
                setDeleteModalOpen(true)
              }}
            />
          </Tooltip>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ))

  return (
    <Frame>
      <NavBar />

      <Page
        title="Affiliate Forms"
        primaryAction={{
          content: 'Create new affiliate form',
          icon: PlusIcon,
          onAction: () => navigate('/affiliate-form/new')
        }}
        secondaryActions={[
          { content: 'Refresh', icon: RefreshIcon, onAction: fetchAffiliateForms }
        ]}
      >
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        <Layout.Section>
          <Card padding="0">
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              <Box padding="400">
                <TextField
                  placeholder="Search affiliate forms"
                  value={searchValue}
                  onChange={setSearchValue}
                  clearButton
                  onClearButtonClick={() => setSearchValue('')}
                  prefix={<Icon source={SearchIcon} />}
                />
              </Box>
            </Tabs>

            {loading ? (
              <Box padding="600" align="center">
                <Spinner />
              </Box>
            ) : filteredForms.length === 0 ? (
              <EmptyState
                heading="Create your first affiliate form"
                action={{
                  content: 'Create affiliate form',
                  onAction: () => navigate('/affiliate-form/new')
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                Collect affiliate registrations easily.
              </EmptyState>
            ) : (
              <>
                <IndexTable
                  itemCount={paginatedForms.length}
                  selectable={false}
                  headings={[
                    { title: 'Name' },
                    { title: 'Copy Form Code' },
                    { title: 'Number of Fields' },
                    { title: 'Number of Submissions' },
                    { title: 'Status' },
                    { title: 'Actions' }
                  ]}
                >
                  {rowMarkup}
                </IndexTable>

                {totalPages > 1 && (
                  <Box padding="400">
                    <Pagination
                      hasPrevious={currentPage > 1}
                      hasNext={currentPage < totalPages}
                      onPrevious={() => setCurrentPage(p => p - 1)}
                      onNext={() => setCurrentPage(p => p + 1)}
                    />
                  </Box>
                )}
              </>
            )}
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
      </Page>

      {/* Delete modal */}
      <Modal
        limitHeight
        open={deleteModalOpen}
        title="Delete affiliate form"
        onClose={() => setDeleteModalOpen(false)}
        primaryAction={{ content: 'Delete', destructive: true, onAction: handleDelete }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setDeleteModalOpen(false) }]}
      >
        <Modal.Section>
          Are you sure you want to delete <b>{selectedForm?.name}</b>?
        </Modal.Section>
      </Modal>

      {toastActive && (
        <Toast
          content={toastMessage}
          error={toastError}
          onDismiss={() => setToastActive(false)}
        />
      )}
    </Frame>
  )
}

export default AffiliateFormPage