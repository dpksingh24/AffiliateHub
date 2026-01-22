/**
 * Form Submissions Controller
 * Handles CRUD operations for form submissions
 */

const { processUploadedFiles, deleteUploadedFiles } = require('../utils/fileUpload');
const EmailService = require('../services/email.services');

// Get all submissions for a form
const getFormSubmissions = async (req, res, db) => {
  try {
    const { formId } = req.params;
    const { shop, page = 1, limit = 20 } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    // Verify form belongs to shop
    let form;
    try {
      form = await db.collection('forms').findOne({ 
        _id: new ObjectId(formId), 
        shop 
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid form ID format' 
      });
    }

    if (!form) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form not found' 
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const submissions = await db.collection('form_submissions')
      .find({ formId })
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('form_submissions')
      .countDocuments({ formId });

    res.json({ 
      success: true, 
      submissions: submissions.map(s => ({
        ...s,
        id: s._id.toString()
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch submissions',
      message: error.message 
    });
  }
};

// Get a single submission by ID
const getSubmissionById = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    let submission;
    try {
      submission = await db.collection('form_submissions').findOne({ 
        _id: new ObjectId(id)
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid submission ID format' 
      });
    }

    if (!submission) {
      return res.status(404).json({ 
        success: false, 
        error: 'Submission not found' 
      });
    }

    // Verify form belongs to shop
    let form;
    try {
      form = await db.collection('forms').findOne({ 
        _id: new ObjectId(submission.formId), 
        shop 
      });
    } catch (e) {
      // Form ID might be stored as string
      form = await db.collection('forms').findOne({ 
        formId: submission.formId, 
        shop 
      });
    }

    if (!form) {
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized access to submission' 
      });
    }

    res.json({ 
      success: true, 
      submission: {
        ...submission,
        id: submission._id.toString()
      }
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch submission',
      message: error.message 
    });
  }
};

// Create a new submission (public endpoint for form submissions)
const createSubmission = async (req, res, db) => {
  try {
    const { formId } = req.params;
    
    // Debug logging for file uploads
    console.log('=== SUBMISSION DEBUG ===');
    console.log('Form ID:', formId);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Is multipart:', req.is('multipart/form-data'));
    console.log('Body keys:', Object.keys(req.body));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Files received:', req.files ? req.files.length : 0);
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        console.log(`File ${index + 1}:`, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          bufferLength: file.buffer ? file.buffer.length : 0
        });
      });
    } else {
      console.log('WARNING: No files in req.files - check if Multer middleware is running');
    }
    console.log('========================');
    
    // Handle both JSON body and multipart form data
    let data = req.body.data;
    let metadata = req.body.metadata;

    // If data is a string (from multipart), parse it
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        // data might already be an object from form fields
        data = req.body;
      }
    }

    // If metadata is a string, parse it
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }

    // For multipart forms, data fields come directly in body
    if (!data || Object.keys(data).length === 0) {
      // Extract data from body, excluding special fields
      data = {};
      const excludeFields = ['metadata', 'data'];
      for (const key of Object.keys(req.body)) {
        if (!excludeFields.includes(key)) {
          data[key] = req.body[key];
        }
      }
    }

    if (!formId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Form ID is required' 
      });
    }

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Submission data is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    // Find form by _id or formId
    let form;
    try {
      form = await db.collection('forms').findOne({ 
        _id: new ObjectId(formId)
      });
    } catch (e) {
      // Try finding by formId string
      form = await db.collection('forms').findOne({ 
        formId: formId
      });
    }

    if (!form) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form not found' 
      });
    }

    if (form.status !== 'Active') {
      return res.status(400).json({ 
        success: false, 
        error: 'Form is not accepting submissions' 
      });
    }

    // Process uploaded files if any
    let uploadedFiles = {};
    if (req.files && req.files.length > 0) {
      try {
        console.log('Processing', req.files.length, 'uploaded file(s)...');
        uploadedFiles = await processUploadedFiles(req.files, formId);
        console.log('Processed uploaded files:', JSON.stringify(uploadedFiles, null, 2));
        
        // Merge file info into data
        for (const [fieldName, fileInfo] of Object.entries(uploadedFiles)) {
          data[fieldName] = fileInfo;
        }
      } catch (uploadError) {
        console.error('Error processing uploads:', uploadError);
        return res.status(400).json({ 
          success: false, 
          error: 'Failed to process uploaded files',
          message: uploadError.message 
        });
      }
    }

    // Create a mapping from field ID to field label
    const fieldIdToLabel = {};
    (form.fields || []).forEach(f => {
      if (f.id && f.label) {
        fieldIdToLabel[f.id] = f.label;
      }
    });

    // Convert data keys from field IDs to labels for better readability
    const labeledData = {};
    for (const [key, value] of Object.entries(data)) {
      const label = fieldIdToLabel[key] || key;
      labeledData[label] = value;
    }

    // Also convert uploaded files keys to labels
    const labeledFiles = {};
    for (const [key, value] of Object.entries(uploadedFiles)) {
      const label = fieldIdToLabel[key] || key;
      labeledFiles[label] = value;
      // Also update in labeledData
      labeledData[label] = value;
    }

    console.log('Field ID to Label mapping:', fieldIdToLabel);
    console.log('Labeled data:', JSON.stringify(labeledData, null, 2));

    // Validate required fields (skip file fields that were uploaded)
    const requiredFields = (form.fields || []).filter(f => f.required);
    const missingFields = requiredFields.filter(f => {
      const hasValue = labeledData[f.label] || labeledData[f.id];
      // For file fields, check if file was uploaded
      if (f.type === 'file') {
        return !hasValue && !labeledFiles[f.label] && !labeledFiles[f.id];
      }
      return !hasValue;
    });

    if (missingFields.length > 0) {
      // Clean up uploaded files if validation fails
      if (Object.keys(uploadedFiles).length > 0) {
        const filePaths = Object.values(uploadedFiles)
          .flat()
          .map(f => f.path);
        deleteUploadedFiles(filePaths);
      }
      
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields',
        missingFields: missingFields.map(f => f.label)
      });
    }

    const newSubmission = {
      formId: form._id.toString(),
      shop: form.shop,
      data,
      files: uploadedFiles,
      metadata: {
        ...metadata,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        referer: req.headers.referer
      },
      submittedAt: new Date(),
      status: 'new'
    };

    const result = await db.collection('form_submissions').insertOne(newSubmission);

    // Send email notification to the submitter
    try {
      // Find email from submission data
      let submitterEmail = null;
      let submitterName = null;
      
      // Common email field names to check
      const emailKeys = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'email address', 'Email Address', 'your email', 'Your Email', 'Your email'];
      const nameKeys = ['name', 'Name', 'NAME', 'full name', 'Full Name', 'your name', 'Your Name', 'Your name', 'first name', 'First Name', 'First name'];
      
      // Search in labeled data and original data
      for (const key of emailKeys) {
        if (labeledData[key]) {
          submitterEmail = labeledData[key];
          break;
        }
        if (data[key]) {
          submitterEmail = data[key];
          break;
        }
      }
      
      // Also check field IDs mapped to labels
      if (!submitterEmail) {
        for (const [fieldId, value] of Object.entries(data)) {
          const label = fieldIdToLabel[fieldId];
          if (label && emailKeys.some(k => label.toLowerCase().includes(k.toLowerCase()))) {
            submitterEmail = value;
            break;
          }
        }
      }
      
      // Find submitter name
      for (const key of nameKeys) {
        if (labeledData[key]) {
          submitterName = labeledData[key];
          break;
        }
        if (data[key]) {
          submitterName = data[key];
          break;
        }
      }
      
      // Also check field IDs mapped to labels for name
      if (!submitterName) {
        for (const [fieldId, value] of Object.entries(data)) {
          const label = fieldIdToLabel[fieldId];
          if (label && nameKeys.some(k => label.toLowerCase().includes(k.toLowerCase()))) {
            submitterName = value;
            break;
          }
        }
      }
      
      if (submitterEmail) {
        console.log(`📧 Sending submission received email to: ${submitterEmail}`);
        const emailResult = await EmailService.sendSubmissionReceivedEmail(
          submitterEmail,
          form.name,
          submitterName
        );
        if (emailResult.success) {
          console.log(`✅ Submission confirmation email sent successfully`);
        } else {
          console.log(`⚠️ Failed to send submission confirmation email: ${emailResult.error}`);
        }
      } else {
        console.log('⚠️ No email field found in submission, skipping confirmation email');
      }
    } catch (emailError) {
      // Don't fail the submission if email fails
      console.error('Error sending submission email:', emailError);
    }

    res.status(201).json({ 
      success: true, 
      message: form.settings?.successMessage || 'Thank you for your submission!',
      submissionId: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit form',
      message: error.message 
    });
  }
};

// Delete a submission
const deleteSubmission = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    // First get the submission to verify ownership
    let submission;
    try {
      submission = await db.collection('form_submissions').findOne({ 
        _id: new ObjectId(id)
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid submission ID format' 
      });
    }

    if (!submission) {
      return res.status(404).json({ 
        success: false, 
        error: 'Submission not found' 
      });
    }

    // Verify form belongs to shop
    let form;
    try {
      form = await db.collection('forms').findOne({ 
        _id: new ObjectId(submission.formId), 
        shop 
      });
    } catch (e) {
      form = await db.collection('forms').findOne({ 
        formId: submission.formId, 
        shop 
      });
    }

    if (!form) {
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized access to submission' 
      });
    }

    await db.collection('form_submissions').deleteOne({ _id: new ObjectId(id) });

    res.json({ 
      success: true, 
      message: 'Submission deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete submission',
      message: error.message 
    });
  }
};

// Delete multiple submissions
const deleteMultipleSubmissions = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { ids } = req.body;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Submission IDs array is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    // Convert string IDs to ObjectIds
    const objectIds = ids.map(id => {
      try {
        return new ObjectId(id);
      } catch (e) {
        return null;
      }
    }).filter(id => id !== null);

    if (objectIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid submission IDs provided' 
      });
    }

    // Get submissions and verify ownership
    const submissions = await db.collection('form_submissions')
      .find({ _id: { $in: objectIds } })
      .toArray();

    // Get unique form IDs
    const formIds = [...new Set(submissions.map(s => s.formId))];

    // Verify all forms belong to shop
    for (const formId of formIds) {
      let form;
      try {
        form = await db.collection('forms').findOne({ 
          _id: new ObjectId(formId), 
          shop 
        });
      } catch (e) {
        form = await db.collection('forms').findOne({ 
          formId: formId, 
          shop 
        });
      }

      if (!form) {
        return res.status(403).json({ 
          success: false, 
          error: 'Unauthorized access to one or more submissions' 
        });
      }
    }

    const result = await db.collection('form_submissions')
      .deleteMany({ _id: { $in: objectIds } });

    res.json({ 
      success: true, 
      message: `${result.deletedCount} submission(s) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting submissions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete submissions',
      message: error.message 
    });
  }
};

// Export submissions as CSV
const exportSubmissions = async (req, res, db) => {
  try {
    const { formId } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    // Verify form belongs to shop
    let form;
    try {
      form = await db.collection('forms').findOne({ 
        _id: new ObjectId(formId), 
        shop 
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid form ID format' 
      });
    }

    if (!form) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form not found' 
      });
    }

    const submissions = await db.collection('form_submissions')
      .find({ formId })
      .sort({ submittedAt: -1 })
      .toArray();

    if (submissions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No submissions to export' 
      });
    }

    // Create field ID to label mapping
    const fieldIdToLabel = {};
    (form.fields || []).forEach(f => {
      if (f.id && f.label) {
        fieldIdToLabel[f.id] = f.label;
      }
    });

    // Get all unique field labels from form fields
    const fieldLabels = (form.fields || []).map(f => f.label);
    
    // Get the base URL for file paths (remove trailing slash if any)
    const baseUrl = (process.env.HOST || '').replace(/\/+$/, '');
    
    // Helper to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '""';
      
      // Handle file objects - export with full URL
      if (typeof value === 'object' && value.path) {
        // Build full URL for the file
        let fileUrl = value.path;
        // Ensure path starts with single slash
        if (fileUrl && !fileUrl.startsWith('/') && !fileUrl.startsWith('http')) {
          fileUrl = '/' + fileUrl;
        }
        // If path is relative (starts with /uploads), prepend base URL
        if (fileUrl && fileUrl.startsWith('/uploads')) {
          fileUrl = baseUrl + fileUrl;
        } else if (fileUrl && !fileUrl.startsWith('http')) {
          fileUrl = baseUrl + '/uploads' + (fileUrl.startsWith('/') ? '' : '/') + fileUrl;
        }
        return `"${String(fileUrl).replace(/"/g, '""')}"`;
      }
      
      // Handle other objects
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      
      return `"${String(value).replace(/"/g, '""')}"`;
    };

    // Helper to get field value by label (handles both ID-keyed and label-keyed data)
    const getFieldValue = (data, label) => {
      if (!data) return '';
      
      // Try direct label access
      if (data[label] !== undefined) return data[label];
      
      // Try finding by field ID
      for (const [key, value] of Object.entries(data)) {
        const fieldLabel = fieldIdToLabel[key];
        if (fieldLabel === label) return value;
      }
      
      return '';
    };

    // Build CSV headers - include all details
    const headers = [
      'Submission ID',
      'Submitted At',
      ...fieldLabels,
      'Status',
      'Approval Status',
      'Approved At',
      'Rejected At',
      'Rejection Reason',
      'Shopify Customer ID',
      'Tag Added',
      'IP Address',
      'User Agent',
      'Page URL'
    ];
    
    // Build CSV rows
    const rows = submissions.map(s => {
      // Get form field values
      const dataValues = fieldLabels.map(label => {
        const value = getFieldValue(s.data, label);
        return escapeCSV(value);
      });
      
      // Format dates
      const submittedAt = s.submittedAt ? new Date(s.submittedAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '';
      
      const approvedAt = s.approvedAt ? new Date(s.approvedAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '';
      
      const rejectedAt = s.rejectedAt ? new Date(s.rejectedAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '';
      
      return [
        escapeCSV(s._id.toString()),
        escapeCSV(submittedAt),
        ...dataValues,
        escapeCSV(s.status || 'new'),
        escapeCSV(s.approvalStatus || 'pending'),
        escapeCSV(approvedAt),
        escapeCSV(rejectedAt),
        escapeCSV(s.rejectionReason || ''),
        escapeCSV(s.shopifyCustomerId || ''),
        escapeCSV(s.tagAdded || ''),
        escapeCSV(s.metadata?.ip || ''),
        escapeCSV(s.metadata?.userAgent || ''),
        escapeCSV(s.metadata?.page || s.metadata?.referer || '')
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const csvWithBOM = '\uFEFF' + csv;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${form.name}-submissions.csv"`);
    res.send(csvWithBOM);
  } catch (error) {
    console.error('Error exporting submissions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export submissions',
      message: error.message 
    });
  }
};

// Search for a Shopify customer by email
const searchCustomerByEmail = async (req, res, db) => {
  try {
    const { email } = req.query;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email parameter is required' 
      });
    }

    // Get shop access token from database
    const shopData = await db.collection('shops').findOne({ shop });
    
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'Shop not authenticated' 
      });
    }

    // Search for customer using Shopify Admin REST API
    const searchUrl = `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/customers/search.json?query=email:${encodeURIComponent(email)}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': shopData.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', errorText);
      return res.status(response.status).json({ 
        success: false, 
        error: 'Failed to search customers',
        details: errorText
      });
    }

    const data = await response.json();
    const customers = data.customers || [];
    
    // Find exact email match
    const customer = customers.find(c => c.email?.toLowerCase() === email.toLowerCase());

    if (customer) {
      res.json({ 
        success: true, 
        exists: true, 
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          tags: customer.tags,
          createdAt: customer.created_at
        }
      });
    } else {
      res.json({ 
        success: true, 
        exists: false, 
        customer: null 
      });
    }
  } catch (error) {
    console.error('Error searching customer:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search customer',
      message: error.message 
    });
  }
};

// Create a new Shopify customer
const createCustomer = async (req, res, db) => {
  try {
    const { email, firstName, lastName, tags } = req.body;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    // Get shop access token from database
    const shopData = await db.collection('shops').findOne({ shop });
    
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'Shop not authenticated' 
      });
    }

    // Create customer using Shopify Admin REST API
    const createUrl = `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/customers.json`;
    
    const customerData = {
      customer: {
        email: email,
        first_name: firstName || '',
        last_name: lastName || '',
        tags: tags || '',
        verified_email: true,
        send_email_welcome: false
      }
    };

    const response = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopData.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Shopify API error (create customer):', errorData);
      
      // Check if customer already exists
      if (errorData.errors && errorData.errors.email && 
          errorData.errors.email.some(e => e.includes('taken') || e.includes('exists'))) {
        return res.status(400).json({ 
          success: false, 
          error: 'A customer with this email already exists',
          details: errorData
        });
      }
      
      return res.status(response.status).json({ 
        success: false, 
        error: 'Failed to create customer',
        details: errorData
      });
    }

    const data = await response.json();
    const customer = data.customer;

    res.json({ 
      success: true, 
      message: 'Customer created successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        tags: customer.tags,
        createdAt: customer.created_at
      }
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create customer',
      message: error.message 
    });
  }
};

// Add tag to a Shopify customer
const addTagToCustomer = async (req, res, db) => {
  try {
    const { customerId, tag } = req.body;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    if (!customerId || !tag) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer ID and tag are required' 
      });
    }

    // Get shop access token from database
    const shopData = await db.collection('shops').findOne({ shop });
    
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'Shop not authenticated' 
      });
    }

    // First, get the current customer to retrieve existing tags
    const getUrl = `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/customers/${customerId}.json`;
    
    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': shopData.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('Shopify API error (get customer):', errorText);
      return res.status(getResponse.status).json({ 
        success: false, 
        error: 'Failed to get customer',
        details: errorText
      });
    }

    const customerData = await getResponse.json();
    const customer = customerData.customer;

    // Add new tag to existing tags (avoid duplicates)
    const existingTags = customer.tags ? customer.tags.split(', ').map(t => t.trim()) : [];
    if (!existingTags.includes(tag)) {
      existingTags.push(tag);
    }
    const newTags = existingTags.join(', ');

    // Update customer with new tags
    const updateUrl = `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/customers/${customerId}.json`;
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': shopData.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: {
          id: customerId,
          tags: newTags
        }
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Shopify API error (update customer):', errorText);
      return res.status(updateResponse.status).json({ 
        success: false, 
        error: 'Failed to update customer tags',
        details: errorText
      });
    }

    const updatedData = await updateResponse.json();
    
    res.json({ 
      success: true, 
      message: 'Tag added successfully',
      customer: {
        id: updatedData.customer.id,
        email: updatedData.customer.email,
        tags: updatedData.customer.tags
      }
    });
  } catch (error) {
    console.error('Error adding tag to customer:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add tag to customer',
      message: error.message 
    });
  }
};

// Approve a submission
const approveSubmission = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;
    const { shopifyCustomerId, tagAdded } = req.body;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    // Get the submission
    let submission;
    try {
      submission = await db.collection('form_submissions').findOne({ 
        _id: new ObjectId(id)
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid submission ID format' 
      });
    }

    if (!submission) {
      return res.status(404).json({ 
        success: false, 
        error: 'Submission not found' 
      });
    }

    // Verify form belongs to shop
    let form;
    try {
      form = await db.collection('forms').findOne({ 
        _id: new ObjectId(submission.formId), 
        shop 
      });
    } catch (e) {
      form = await db.collection('forms').findOne({ 
        formId: submission.formId, 
        shop 
      });
    }

    if (!form) {
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized access to submission' 
      });
    }

    // Update submission with approval status
    const updateResult = await db.collection('form_submissions').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          approvalStatus: 'approved',
          approvedAt: new Date(),
          shopifyCustomerId: shopifyCustomerId || null,
          tagAdded: tagAdded || null
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update submission' 
      });
    }

    // Send approval email to the submitter
    try {
      // Create field ID to label mapping from form
      const fieldIdToLabel = {};
      (form.fields || []).forEach(f => {
        if (f.id && f.label) {
          fieldIdToLabel[f.id] = f.label;
        }
      });
      
      // Find email and name from submission data
      let submitterEmail = null;
      let submitterName = null;
      
      const emailKeys = ['email', 'e-mail', 'email address', 'your email', 'your account email'];
      const nameKeys = ['name', 'full name', 'your name', 'first name', 'given name'];
      
      const submissionData = submission.data || {};
      
      for (const [key, value] of Object.entries(submissionData)) {
        if (!value || typeof value !== 'string') continue;
        
        // Get the label for this key (key might be a field ID)
        const label = fieldIdToLabel[key] || key;
        const labelLower = label.toLowerCase();
        
        // Check for email
        if (!submitterEmail) {
          if (emailKeys.some(k => labelLower.includes(k)) || value.includes('@')) {
            submitterEmail = value;
          }
        }
        
        // Check for name
        if (!submitterName) {
          if (nameKeys.some(k => labelLower.includes(k))) {
            submitterName = value;
          }
        }
      }
      
      console.log('Approval - Found email:', submitterEmail, 'name:', submitterName);
      
      if (submitterEmail) {
        console.log(`📧 Sending approval email to: ${submitterEmail}`);
        const emailResult = await EmailService.sendApprovalEmail(
          submitterEmail,
          form.name,
          submitterName
        );
        if (emailResult.success) {
          console.log(`✅ Approval email sent successfully`);
        } else {
          console.log(`⚠️ Failed to send approval email: ${emailResult.error}`);
        }
      } else {
        console.log('⚠️ No email found in submission for approval notification');
      }
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Submission approved successfully'
    });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to approve submission',
      message: error.message 
    });
  }
};

// Reject a submission
const rejectSubmission = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;
    const { reason } = req.body;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    // Get the submission
    let submission;
    try {
      submission = await db.collection('form_submissions').findOne({ 
        _id: new ObjectId(id)
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid submission ID format' 
      });
    }

    if (!submission) {
      return res.status(404).json({ 
        success: false, 
        error: 'Submission not found' 
      });
    }

    // Verify form belongs to shop
    let form;
    try {
      form = await db.collection('forms').findOne({ 
        _id: new ObjectId(submission.formId), 
        shop 
      });
    } catch (e) {
      form = await db.collection('forms').findOne({ 
        formId: submission.formId, 
        shop 
      });
    }

    if (!form) {
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized access to submission' 
      });
    }

    // Update submission with rejection status
    const updateResult = await db.collection('form_submissions').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          approvalStatus: 'rejected',
          rejectedAt: new Date(),
          rejectionReason: reason || null
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update submission' 
      });
    }

    // Send rejection email to the submitter
    try {
      // Create field ID to label mapping from form
      const fieldIdToLabel = {};
      (form.fields || []).forEach(f => {
        if (f.id && f.label) {
          fieldIdToLabel[f.id] = f.label;
        }
      });
      
      // Find email and name from submission data
      let submitterEmail = null;
      let submitterName = null;
      
      const emailKeys = ['email', 'e-mail', 'email address', 'your email', 'your account email'];
      const nameKeys = ['name', 'full name', 'your name', 'first name', 'given name'];
      
      const submissionData = submission.data || {};
      
      for (const [key, value] of Object.entries(submissionData)) {
        if (!value || typeof value !== 'string') continue;
        
        // Get the label for this key (key might be a field ID)
        const label = fieldIdToLabel[key] || key;
        const labelLower = label.toLowerCase();
        
        // Check for email
        if (!submitterEmail) {
          if (emailKeys.some(k => labelLower.includes(k)) || value.includes('@')) {
            submitterEmail = value;
          }
        }
        
        // Check for name
        if (!submitterName) {
          if (nameKeys.some(k => labelLower.includes(k))) {
            submitterName = value;
          }
        }
      }
      
      console.log('Rejection - Found email:', submitterEmail, 'name:', submitterName);
      
      if (submitterEmail) {
        console.log(`📧 Sending rejection email to: ${submitterEmail}`);
        const emailResult = await EmailService.sendRejectionEmail(
          submitterEmail,
          form.name,
          submitterName,
          reason
        );
        if (emailResult.success) {
          console.log(`✅ Rejection email sent successfully`);
        } else {
          console.log(`⚠️ Failed to send rejection email: ${emailResult.error}`);
        }
      } else {
        console.log('⚠️ No email found in submission for rejection notification');
      }
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Submission rejected'
    });
  } catch (error) {
    console.error('Error rejecting submission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reject submission',
      message: error.message 
    });
  }
};

module.exports = {
  getFormSubmissions,
  getSubmissionById,
  createSubmission,
  deleteSubmission,
  deleteMultipleSubmissions,
  exportSubmissions,
  searchCustomerByEmail,
  createCustomer,
  addTagToCustomer,
  approveSubmission,
  rejectSubmission
};
