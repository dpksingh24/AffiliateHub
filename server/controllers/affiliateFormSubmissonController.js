const { ObjectId } = require('mongodb');
const { processUploadedFiles, deleteUploadedFiles } = require('../utils/fileUpload');
const EmailService = require('../services/email.services');
const { getEmailTemplate } = require('../services/emailTemplates');
const { createAffiliateProfile, createReferralLink, getAffiliateByCustomerId } = require('../models/affiliate.model');

// Helper: extract an email from a submission object (direct field or inside data)
function extractEmailFromSubmission(submission, form) {
    if (!submission) return null;

    // Direct email field
    if (submission.email) return submission.email;

    // Check common keys in submission.data
    const emailKeys = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'email_address', 'EmailAddress', 'email address', 'Email Address'];
    if (submission.data && typeof submission.data === 'object') {
        for (const key of emailKeys) {
            if (submission.data[key]) return submission.data[key];
        }

        // If form.fields exists, try mapping field ids to labels (if email label exists)
        if (form && Array.isArray(form.fields)) {
            const emailLabelKeys = ['email', 'e-mail', 'email address', 'your email'];
            const fieldIdToLabel = {};
            form.fields.forEach(f => { if (f.id && f.label) fieldIdToLabel[f.id] = f.label; });
            for (const [fid, val] of Object.entries(submission.data)) {
                const label = fieldIdToLabel[fid];
                if (label && emailLabelKeys.some(k => label.toLowerCase().includes(k))) return val;
            }
        }

        // Fallback: scan values for something that looks like an email
        const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
        for (const [k, v] of Object.entries(submission.data)) {
            if (typeof v === 'string' && emailRegex.test(v)) return v;
        }
    }

    return null;
}

// Helper: extract payment/PayPal email from submission (for affiliate profile)
function extractPaymentEmailFromSubmission(submission, form) {
    if (!submission || !submission.data || typeof submission.data !== 'object') return null;

    const paymentLabelKeys = ['payment email', 'paypal email', 'paypal', 'payment email address', 'your payment email', 'paypal account', 'payout email'];
    if (form && Array.isArray(form.fields)) {
        const fieldIdToLabel = {};
        form.fields.forEach(f => { if (f.id && f.label) fieldIdToLabel[f.id] = (f.label || '').toLowerCase(); });
        for (const [fid, val] of Object.entries(submission.data)) {
            if (!val || typeof val !== 'string') continue;
            const label = fieldIdToLabel[fid] || '';
            if (paymentLabelKeys.some(k => label.includes(k))) return val.trim();
        }
    }

    const paymentKeys = ['paymentEmail', 'payment_email', 'paypalEmail', 'paypal_email', 'payment email', 'PayPal email'];
    for (const key of paymentKeys) {
        const v = submission.data[key];
        if (v && typeof v === 'string') return v.trim();
    }
    return null;
}

// Helper: extract full name from submission (from submission.data, for affiliate profile)
function extractNameFromSubmission(submission, form) {
    if (!submission || !submission.data || typeof submission.data !== 'object') return null;

    const data = submission.data;
    const fullNameKeys = ['name', 'Name', 'NAME', 'full name', 'Full Name', 'your name', 'Your Name', 'Full name'];
    for (const key of fullNameKeys) {
        const v = data[key];
        if (v && typeof v === 'string' && v.trim()) return v.trim();
    }

    // Map field ids to labels and look for name-like labels
    if (form && Array.isArray(form.fields)) {
        const fieldIdToLabel = {};
        form.fields.forEach(f => { if (f.id && f.label) fieldIdToLabel[f.id] = (f.label || '').toLowerCase(); });
        for (const [fid, val] of Object.entries(data)) {
            if (!val || typeof val !== 'string') continue;
            const label = fieldIdToLabel[fid] || '';
            if (fullNameKeys.some(k => k.toLowerCase() === label || label.includes(k.toLowerCase()))) return val.trim();
        }

        // First name + last name
        let firstName = null;
        let lastName = null;
        const firstLabelKeys = ['first name', 'firstname', 'given name'];
        const lastLabelKeys = ['last name', 'lastname', 'surname', 'family name'];
        for (const [fid, val] of Object.entries(data)) {
            if (!val || typeof val !== 'string') continue;
            const label = fieldIdToLabel[fid] || '';
            if (firstLabelKeys.some(k => label.includes(k))) firstName = val.trim();
            if (lastLabelKeys.some(k => label.includes(k))) lastName = val.trim();
        }
        if (firstName && lastName) return `${firstName} ${lastName}`.trim();
        if (firstName) return firstName;
        if (lastName) return lastName;
    }

    // Fallback: direct keys for first/last
    const firstKeys = ['firstName', 'first_name', 'first name', 'First name'];
    const lastKeys = ['lastName', 'last_name', 'last name', 'Last name'];
    let first = null, last = null;
    for (const key of firstKeys) { if (data[key] && typeof data[key] === 'string') { first = data[key].trim(); break; } }
    for (const key of lastKeys) { if (data[key] && typeof data[key] === 'string') { last = data[key].trim(); break; } }
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (last) return last;

    return null;
}

// Helper: extract first name and last name from submission (for affiliate profile)
function extractFirstAndLastNameFromSubmission(submission, form) {
    if (!submission || !submission.data || typeof submission.data !== 'object') {
        return { firstName: null, lastName: null };
    }

    const data = submission.data;
    let firstName = null;
    let lastName = null;

    if (form && Array.isArray(form.fields)) {
        const fieldIdToLabel = {};
        form.fields.forEach(f => { if (f.id && f.label) fieldIdToLabel[f.id] = (f.label || '').toLowerCase(); });
        const firstLabelKeys = ['first name', 'firstname', 'given name'];
        const lastLabelKeys = ['last name', 'lastname', 'surname', 'family name'];
        for (const [fid, val] of Object.entries(data)) {
            if (!val || typeof val !== 'string') continue;
            const label = fieldIdToLabel[fid] || '';
            if (firstLabelKeys.some(k => label.includes(k))) firstName = val.trim();
            if (lastLabelKeys.some(k => label.includes(k))) lastName = val.trim();
        }
    }

    if (firstName === null || lastName === null) {
        const firstKeys = ['firstName', 'first_name', 'first name', 'First name'];
        const lastKeys = ['lastName', 'last_name', 'last name', 'Last name'];
        if (firstName === null) {
            for (const key of firstKeys) {
                if (data[key] && typeof data[key] === 'string') {
                    firstName = data[key].trim();
                    break;
                }
            }
        }
        if (lastName === null) {
            for (const key of lastKeys) {
                if (data[key] && typeof data[key] === 'string') {
                    lastName = data[key].trim();
                    break;
                }
            }
        }
    }

    return { firstName: firstName || null, lastName: lastName || null };
}

// Create a new affiliate form submission (public endpoint)
const createAffiliateFormSubmission = async (req, res, db) => {
    try {
        const { formId } = req.params;
        
        // Debug logging for file uploads
        console.log('=== AFFILIATE FORM SUBMISSION DEBUG ===');
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
        }
        console.log('========================================');
        
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

        // Find form by _id or formId
        let form;
        try {
            form = await db.collection('affiliate_forms').findOne({
                _id: new ObjectId(formId)
            });
        } catch (e) {
            // Try finding by formId string
            form = await db.collection('affiliate_forms').findOne({
                formId: formId
            });
        }

        if (!form) {
            return res.status(404).json({
                success: false,
                error: 'Affiliate form not found'
            });
        }

        if (form.status !== 'Active') {
            return res.status(400).json({
                success: false,
                error: 'Affiliate form is not accepting submissions'
            });
        }

        // Check for duplicate email submission
        try {
            let submitterEmail = null;
            
            const emailKeys = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'email address', 'Email Address', 'your email', 'Your Email', 'Your email'];
            
            // Create field ID to label mapping
            const fieldIdToLabel = {};
            (form.fields || []).forEach(f => {
                if (f.id && f.label) {
                    fieldIdToLabel[f.id] = f.label;
                }
            });
            
            // Search for email in data
            for (const key of emailKeys) {
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
            
            // If email found, check for existing submission
            if (submitterEmail) {
                console.log(`Checking for duplicate affiliate form email: ${submitterEmail}`);
                
                const existingSubmission = await db.collection('affiliate_form_submissions').findOne({
                    formId: form._id.toString(),
                    $or: [
                        ...emailKeys.map(key => ({ [`data.${key}`]: submitterEmail })),
                        ...(form.fields || [])
                            .filter(f => emailKeys.some(k => f.label?.toLowerCase().includes(k.toLowerCase())))
                            .map(f => ({ [`data.${f.id}`]: submitterEmail }))
                    ]
                });
                
                if (existingSubmission) {
                    console.log(`⚠️ Duplicate affiliate form submission detected for email: ${submitterEmail}`);
                    return res.status(400).json({
                        success: false,
                        error: 'A submission with this email address has already been submitted for this form'
                    });
                }
            }
        } catch (duplicateCheckError) {
            console.error('Error checking for duplicate email:', duplicateCheckError);
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

        // Create field ID to label mapping for better readability
        const fieldIdToLabel = {};
        (form.fields || []).forEach(f => {
            if (f.id && f.label) {
                fieldIdToLabel[f.id] = f.label;
            }
        });

        // Convert data keys from field IDs to labels
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
            labeledData[label] = value;
        }

        console.log('Field ID to Label mapping:', fieldIdToLabel);
        console.log('Labeled data:', JSON.stringify(labeledData, null, 2));

        // Validate required fields
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

        const result = await db.collection('affiliate_form_submissions').insertOne(newSubmission);

        // Send email notification to the submitter
        try {
            let submitterEmail = null;
            let submitterName = null;
            
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
            // Build full name from first + last if we have separate fields
            let applicantFullName = submitterName;
            const firstKeys = ['first name', 'First Name', 'firstname', 'FirstName', 'first'];
            const lastKeys = ['last name', 'Last Name', 'lastname', 'LastName', 'last', 'surname'];
            let firstName = null, lastName = null;
            for (const key of firstKeys) {
                if (labeledData[key]) { firstName = labeledData[key]; break; }
                if (data[key]) { firstName = data[key]; break; }
            }
            if (!firstName) {
                for (const [fieldId, value] of Object.entries(data)) {
                    const label = fieldIdToLabel[fieldId];
                    if (label && /first\s*name|firstname/i.test(label)) { firstName = value; break; }
                }
            }
            for (const key of lastKeys) {
                if (labeledData[key]) { lastName = labeledData[key]; break; }
                if (data[key]) { lastName = data[key]; break; }
            }
            if (!lastName) {
                for (const [fieldId, value] of Object.entries(data)) {
                    const label = fieldIdToLabel[fieldId];
                    if (label && /last\s*name|lastname|surname/i.test(label)) { lastName = value; break; }
                }
            }
            if (firstName && lastName) applicantFullName = `${String(firstName).trim()} ${String(lastName).trim()}`;
            else if (firstName) applicantFullName = applicantFullName || firstName;
            else if (lastName) applicantFullName = applicantFullName || lastName;
            
            if (submitterEmail) {
                console.log(`📧 Sending affiliate form submission confirmation email to: ${submitterEmail}`);
                const template = await getEmailTemplate(db, form.shop, 'affiliate_registration');
                const emailResult = await EmailService.sendAffiliateRegistrationEmail(
                    submitterEmail,
                    form.name,
                    submitterName,
                    template
                );
                if (emailResult.success) {
                    console.log(`✅ Affiliate form confirmation email sent successfully`);
                } else {
                    console.log(`⚠️ Failed to send affiliate form confirmation email: ${emailResult.error}`);
                }
            } else {
                console.log('⚠️ No email field found in affiliate form submission, skipping confirmation email');
            }

            // Notify admin of new affiliate form submission
            try {
                const adminResult = await EmailService.sendNewSubmissionNotificationToAdmin(form.name, 'affiliate', applicantFullName, submitterEmail);
                if (adminResult.success) {
                    console.log('✅ Admin notification email sent');
                } else {
                    console.log(`⚠️ Admin notification failed: ${adminResult.error}`);
                }
            } catch (adminEmailError) {
                console.error('Error sending admin notification:', adminEmailError);
            }
        } catch (emailError) {
            console.error('Error sending affiliate form submission email:', emailError);
        }

        res.status(201).json({
            success: true,
            message: form.settings?.successMessage || 'Thank you for your affiliate registration!',
            submissionId: result.insertedId.toString()
        });
    } catch (error) {
        console.error('Error creating affiliate form submission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit affiliate form',
            message: error.message
        });
    }
};

// Get all submissions for an affiliate form
const getAffiliateFormSubmissions = async (req, res, db) => {
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
            form = await db.collection('affiliate_forms').findOne({
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
                error: 'Affiliate form not found'
            });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const submissions = await db.collection('affiliate_form_submissions')
            .find({ formId })
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('affiliate_form_submissions')
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
        console.error('Error fetching affiliate form submissions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch submissions',
            message: error.message
        });
    }
};

// Get a single submission by ID
const getAffiliateFormSubmissionById = async (req, res, db) => {
    try {
        const { formId, id } = req.params;
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
            submission = await db.collection('affiliate_form_submissions').findOne({
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
            form = await db.collection('affiliate_forms').findOne({
                _id: new ObjectId(submission.formId),
                shop
            });
        } catch (e) {
            form = await db.collection('affiliate_forms').findOne({
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
        console.error('Error fetching affiliate form submission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch submission',
            message: error.message
        });
    }
};

// Delete a submission
const deleteAffiliateFormSubmission = async (req, res, db) => {
    try {
        const { formId, id } = req.params;
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
            submission = await db.collection('affiliate_form_submissions').findOne({
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
            form = await db.collection('affiliate_forms').findOne({
                _id: new ObjectId(submission.formId),
                shop
            });
        } catch (e) {
            form = await db.collection('affiliate_forms').findOne({
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

        // ✅ Debugging: Also attempt to delete affiliated affiliate record(s)
        // Find customer ID or email from submission data
        let customerId = submission.customerId;
        let affiliateEmail = submission.email;

        // If not stored directly, try to extract from submission data
        if (submission.data) {
            const data = submission.data;
            if (!customerId) {
                customerId = data.customerId || data.customer_id || data.customerID || null;
            }
            if (!affiliateEmail) {
                affiliateEmail = data.email || data.Email || data.EMAIL || data.EmailAddress || data.email_address || null;
            }

            // Heuristic scan: look for any value that resembles an email or a long numeric id
            const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
            for (const [k, v] of Object.entries(data)) {
                if (!affiliateEmail && typeof v === 'string' && emailRegex.test(v)) {
                    affiliateEmail = v;
                    console.log('🔎 Found email in submission.data value:', k, v);
                }

                if (!customerId && (typeof v === 'string' || typeof v === 'number')) {
                    const str = String(v).trim();
                    // Consider numeric strings of length >=6 as potential customer IDs
                    const digits = str.replace(/\D/g, '');
                    if (digits.length >= 6 && /^\d+$/.test(digits)) {
                        customerId = digits;
                        console.log('🔎 Found numeric candidate for customerId in submission.data:', k, v);
                    }
                }

                if (affiliateEmail && customerId) break;
            }
        }

        console.log('🧾 deleteAffiliateFormSubmission - submission:', JSON.stringify({ id: submission._id?.toString?.() || submission._id, customerId: submission.customerId, email: submission.email, data: submission.data }));
        console.log('🔎 Parsed identifiers:', { customerId, affiliateEmail, shop });

        // Delete affiliate record(s) if we have customer ID or email
        if (customerId || affiliateEmail) {
            const or = [];

            if (customerId) {
                const custNum = Number(customerId);
                if (!isNaN(custNum)) {
                    or.push({ customerId: custNum });
                }
                or.push({ customerId: String(customerId) });
            }

            if (affiliateEmail) {
                or.push({ email: affiliateEmail });
            }

            const deleteQuery = { shop };
            if (or.length > 0) deleteQuery.$or = or;

            try {
                console.log('🧭 Affiliate deleteQuery:', JSON.stringify(deleteQuery));

                // Find matching affiliates before deletion (need their shortCodes for referral_clicks/conversions)
                const matches = await db.collection('affiliates').find(deleteQuery).toArray();
                console.log(`🔍 Found ${matches.length} matching affiliate(s) before delete`);
                matches.forEach(m => console.log('  - match:', JSON.stringify({ _id: m._id?.toString?.(), customerId: m.customerId, email: m.email, shop: m.shop })));

                // Collect shortCodes and affiliateIds from matches for referral_clicks / referral_conversions
                const shortCodes = [];
                const affiliateIds = [];
                for (const m of matches) {
                    if (m._id) affiliateIds.push(m._id.toString());
                    if (Array.isArray(m.referralLinks)) {
                        for (const link of m.referralLinks) {
                            if (link && link.shortCode) shortCodes.push(link.shortCode);
                        }
                    }
                    if (m.customerId != null) shortCodes.push(String(m.customerId)); // legacy conversions
                }
                const uniqueShortCodes = [...new Set(shortCodes)];

                // Delete referral_clicks for this user (by shortCode and by affiliateId)
                if (uniqueShortCodes.length > 0 || affiliateIds.length > 0) {
                    const clickQuery = { $or: [] };
                    if (uniqueShortCodes.length > 0) clickQuery.$or.push({ shortCode: { $in: uniqueShortCodes } });
                    if (affiliateIds.length > 0) clickQuery.$or.push({ affiliateId: { $in: affiliateIds } });
                    if (clickQuery.$or.length > 0) {
                        const clicksResult = await db.collection('referral_clicks').deleteMany(clickQuery);
                        console.log('🗑️ referral_clicks deleteMany:', clicksResult.deletedCount);
                    }
                    if (uniqueShortCodes.length > 0) {
                        const convResult = await db.collection('referral_conversions').deleteMany({ shortCode: { $in: uniqueShortCodes } });
                        console.log('🗑️ referral_conversions deleteMany:', convResult.deletedCount);
                    }
                }

                // Perform affiliate deletion
                const deleteResult = await db.collection('affiliates').deleteMany(deleteQuery);
                console.log('🗑️ affiliate deleteMany result:', JSON.stringify({ deletedCount: deleteResult.deletedCount }));

                if (deleteResult.deletedCount > 0) {
                    console.log(`✅ Deleted ${deleteResult.deletedCount} affiliate record(s) for identifiers: ${customerId || affiliateEmail}`);
                } else {
                    console.log('⚠️ No affiliate records deleted (no matches)');
                }
            } catch (err) {
                console.error('❌ Error while deleting affiliate records:', err);
            }
        } else {
            console.log('ℹ️ No customerId or email found on submission to delete affiliate records');
        }

        // Delete the submission
        await db.collection('affiliate_form_submissions').deleteOne({ _id: new ObjectId(id) });

        res.json({
            success: true,
            message: 'Submission and affiliated affiliate record deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting affiliate form submission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete submission',
            message: error.message
        });
    }
};

// Delete multiple submissions
const deleteMultipleAffiliateFormSubmissions = async (req, res, db) => {
    try {
        const { formId } = req.params;
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
        const submissions = await db.collection('affiliate_form_submissions')
            .find({ _id: { $in: objectIds } })
            .toArray();

        // Verify form belongs to shop
        let form;
        try {
            form = await db.collection('affiliate_forms').findOne({
                _id: new ObjectId(formId),
                shop
            });
        } catch (e) {
            form = await db.collection('affiliate_forms').findOne({
                formId: formId,
                shop
            });
        }

        if (!form) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized access to submissions'
            });
        }

        // ✅ NEW: Extract customer IDs and emails from submissions to delete affiliated records
        const customerIdsToDelete = new Set();
        const emailsToDelete = new Set();
        
        submissions.forEach(submission => {
            if (submission.customerId) {
                customerIdsToDelete.add(submission.customerId);
            }
            if (submission.email) {
                emailsToDelete.add(submission.email);
            }
            // Also try to extract from submission data
            if (submission.data) {
                const data = submission.data;
                if (data.customerId || data.customer_id || data.customerID) {
                    customerIdsToDelete.add(data.customerId || data.customer_id || data.customerID);
                }
                if (data.email || data.Email || data.EMAIL) {
                    emailsToDelete.add(data.email || data.Email || data.EMAIL);
                }
            }
        });

        // Delete all affiliated affiliate records
        const deleteQuery = { shop };
        if (customerIdsToDelete.size > 0 || emailsToDelete.size > 0) {
            const $or = [];
            
            if (customerIdsToDelete.size > 0) {
                $or.push({ customerId: { $in: Array.from(customerIdsToDelete) } });
            }
            
            if (emailsToDelete.size > 0) {
                $or.push({ email: { $in: Array.from(emailsToDelete) } });
            }
            
            if ($or.length > 0) {
                deleteQuery.$or = $or;
            }
        }

        if (deleteQuery.$or || customerIdsToDelete.size > 0 || emailsToDelete.size > 0) {
            // Find matching affiliates first to get shortCodes for referral_clicks/conversions
            const matches = await db.collection('affiliates').find(deleteQuery).toArray();
            const shortCodes = [];
            const affiliateIds = [];
            for (const m of matches) {
                if (m._id) affiliateIds.push(m._id.toString());
                if (Array.isArray(m.referralLinks)) {
                    for (const link of m.referralLinks) {
                        if (link && link.shortCode) shortCodes.push(link.shortCode);
                    }
                }
                if (m.customerId != null) shortCodes.push(String(m.customerId));
            }
            const uniqueShortCodes = [...new Set(shortCodes)];

            if (uniqueShortCodes.length > 0 || affiliateIds.length > 0) {
                const clickQuery = { $or: [] };
                if (uniqueShortCodes.length > 0) clickQuery.$or.push({ shortCode: { $in: uniqueShortCodes } });
                if (affiliateIds.length > 0) clickQuery.$or.push({ affiliateId: { $in: affiliateIds } });
                if (clickQuery.$or.length > 0) {
                    await db.collection('referral_clicks').deleteMany(clickQuery);
                }
                if (uniqueShortCodes.length > 0) {
                    await db.collection('referral_conversions').deleteMany({ shortCode: { $in: uniqueShortCodes } });
                }
            }

            const affiliateDeleteResult = await db.collection('affiliates').deleteMany(deleteQuery);
            if (affiliateDeleteResult.deletedCount > 0) {
                console.log(`✅ Deleted ${affiliateDeleteResult.deletedCount} affiliated record(s)`);
            }
        }

        // Delete the submissions
        const result = await db.collection('affiliate_form_submissions')
            .deleteMany({ _id: { $in: objectIds } });

        res.json({
            success: true,
            message: `${result.deletedCount} submission(s) and affiliated record(s) deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error deleting affiliate form submissions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete submissions',
            message: error.message
        });
    }
};

// Approve an affiliate form submission
const approveAffiliateFormSubmission = async (req, res, db) => {
    try {
        const { formId, id } = req.params;
        const { shop } = req.query;
        const { shopifyCustomerId, tagAdded } = req.body;

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
            submission = await db.collection('affiliate_form_submissions').findOne({
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
            form = await db.collection('affiliate_forms').findOne({
                _id: new ObjectId(submission.formId),
                shop
            });
        } catch (e) {
            form = await db.collection('affiliate_forms').findOne({
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

        // Update submission with approval
        const updateData = {
            approvalStatus: 'approved',
            approvedAt: new Date(),
            approvedBy: shop
        };

        if (shopifyCustomerId) {
            updateData.shopifyCustomerId = shopifyCustomerId;
        }

        if (tagAdded) {
            updateData.tagAdded = tagAdded;
        }

        await db.collection('affiliate_form_submissions').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        // Set affiliate profile status to 'active' (or create affiliate if none exists yet)
        const approvedEmail = extractEmailFromSubmission(submission, form);
        const paymentEmail = extractPaymentEmailFromSubmission(submission, form);
        const approvedCustomerId = shopifyCustomerId || submission.shopifyCustomerId || submission.customerId;
        const approvedName = extractNameFromSubmission(submission, form) || 'Affiliate';
        const { firstName: approvedFirstName, lastName: approvedLastName } = extractFirstAndLastNameFromSubmission(submission, form);

        let affiliate = null;
        if (approvedCustomerId) {
            affiliate = await getAffiliateByCustomerId(db, String(approvedCustomerId), shop)
                || await getAffiliateByCustomerId(db, Number(approvedCustomerId), shop);
        }
        if (!affiliate && approvedEmail) {
            affiliate = await db.collection('affiliates').findOne({ shop, email: approvedEmail });
        }

        const affiliateUpdate = { status: 'active', updatedAt: new Date() };
        if (paymentEmail) affiliateUpdate.paymentEmail = paymentEmail;
        if (approvedName && approvedName !== 'Affiliate') affiliateUpdate.name = approvedName;
        if (approvedFirstName) affiliateUpdate.firstName = approvedFirstName;
        if (approvedLastName) affiliateUpdate.lastName = approvedLastName;

        try {
            if (affiliate) {
                await db.collection('affiliates').updateOne(
                    { _id: affiliate._id },
                    { $set: affiliateUpdate }
                );
                console.log('✅ Affiliate status set to active for approved submission' + (paymentEmail ? ' (payment email saved)' : ''));
            } else if (approvedCustomerId && approvedEmail) {
                // Create affiliate on approval if none exists (so Share Cart works even if profile is created after approval)
                affiliate = await getAffiliateByCustomerId(db, String(approvedCustomerId), shop)
                    || await getAffiliateByCustomerId(db, Number(approvedCustomerId), shop);
                if (!affiliate) {
                    affiliate = await db.collection('affiliates').findOne({ shop, email: approvedEmail });
                }
                if (affiliate) {
                    await db.collection('affiliates').updateOne(
                        { _id: affiliate._id },
                        { $set: affiliateUpdate }
                    );
                    console.log('✅ Affiliate status set to active for approved submission' + (paymentEmail ? ' (payment email saved)' : ''));
                } else {
                    const newAffiliate = await createAffiliateProfile(db, {
                        customerId: approvedCustomerId,
                        shop,
                        email: approvedEmail,
                        name: approvedName,
                        firstName: approvedFirstName || undefined,
                        lastName: approvedLastName || undefined,
                        paymentEmail: paymentEmail || undefined
                    });
                    await db.collection('affiliates').updateOne(
                        { _id: newAffiliate._id },
                        { $set: { status: 'active', updatedAt: new Date(), ...(paymentEmail && { paymentEmail }) } }
                    );
                    await createReferralLink(db, newAffiliate._id.toString(), {
                        description: 'Main Referral Link',
                        productIds: [],
                        productVariantIds: []
                    });
                    console.log('✅ Affiliate profile created and set to active on approval' + (paymentEmail ? ' (payment email saved)' : ''));
                }
            }
        } catch (affErr) {
            console.error('Error setting affiliate active on approve:', affErr);
        }

        // 🔔 SEND APPROVAL EMAIL
        try {
            const toEmail = extractEmailFromSubmission(submission, form);
            console.log('✉️ Approve: resolved email ->', toEmail);
            if (toEmail) {
                const template = await getEmailTemplate(db, form.shop, 'affiliate_approval');
                const dashboardUrl = form.shop ? `https://${form.shop}/pages/affiliate-dashboard` : undefined;
                const attachment = req.file ? { filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype } : null;
                const emailResult = await EmailService.sendAffiliateApprovalEmail(
                    toEmail,
                    form.name || 'Affiliate Program',
                    approvedName !== 'Affiliate' ? approvedName : null,
                    template,
                    dashboardUrl,
                    attachment
                );
                console.log('✉️ Approval email send result:', emailResult);
            } else {
                console.warn('⚠️ Approve: no email found on submission; skipping approval email');
            }
        } catch (emailError) {
            console.error('Approval email failed:', emailError);
        }

        res.json({
            success: true,
            message: 'Affiliate submission approved successfully',
            submission: {
                ...submission,
                ...updateData,
                id: submission._id.toString()
            }
        });
    } catch (error) {
        console.error('Error approving affiliate submission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve submission',
            message: error.message
        });
    }
};

// Reject an affiliate form submission
const rejectAffiliateFormSubmission = async (req, res, db) => {
    try {
        const { formId, id } = req.params;
        const { shop } = req.query;
        const { reason } = req.body;

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
            submission = await db.collection('affiliate_form_submissions').findOne({
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
            form = await db.collection('affiliate_forms').findOne({
                _id: new ObjectId(submission.formId),
                shop
            });
        } catch (e) {
            form = await db.collection('affiliate_forms').findOne({
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

        // Update submission with rejection
        const updateData = {
            approvalStatus: 'rejected',
            rejectedAt: new Date(),
            rejectedBy: shop
        };

        if (reason) {
            updateData.rejectionReason = reason;
        }

        await db.collection('affiliate_form_submissions').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        // 🔔 SEND REJECTION EMAIL
        try {
            const toEmail = extractEmailFromSubmission(submission, form);
            console.log('✉️ Reject: resolved email ->', toEmail);
            if (toEmail) {
                const template = await getEmailTemplate(db, form.shop, 'affiliate_rejection');
                const attachment = req.file ? { filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype } : null;
                const submitterName = extractNameFromSubmission(submission, form);
                const emailResult = await EmailService.sendAffiliateRejectionEmail(
                    toEmail,
                    form.name || 'Affiliate Program',
                    submitterName || null,
                    reason || null,
                    template,
                    attachment
                );
                console.log('✉️ Rejection email send result:', emailResult);
            } else {
                console.warn('⚠️ Reject: no email found on submission; skipping rejection email');
            }
        } catch (emailError) {
            console.error('Rejection email failed:', emailError);
        }


        res.json({
            success: true,
            message: 'Affiliate submission rejected successfully',
            submission: {
                ...submission,
                ...updateData,
                id: submission._id.toString()
            }
        });
    } catch (error) {
        console.error('Error rejecting affiliate submission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject submission',
            message: error.message
        });
    }
};


module.exports = {
    createAffiliateFormSubmission,
    getAffiliateFormSubmissions,
    getAffiliateFormSubmissionById,
    deleteAffiliateFormSubmission,
    deleteMultipleAffiliateFormSubmissions,
    approveAffiliateFormSubmission,
    rejectAffiliateFormSubmission,
    extractEmailFromSubmission,
    extractNameFromSubmission,
    extractFirstAndLastNameFromSubmission,
};