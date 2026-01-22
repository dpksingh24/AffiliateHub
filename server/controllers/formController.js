/**
 * Form Builder Controller
 * Handles CRUD operations for forms
 */

// Get all forms for a shop
const getAllForms = async (req, res, db) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const forms = await db.collection('forms')
      .find({ shop })
      .sort({ createdAt: -1 })
      .toArray();

    // Get submission counts for each form
    const formsWithCounts = await Promise.all(
      forms.map(async (form) => {
        const submissionCount = await db.collection('form_submissions')
          .countDocuments({ formId: form._id.toString() });
        
        return {
          ...form,
          id: form._id.toString(),
          totalSubmissions: submissionCount
        };
      })
    );

    res.json({ 
      success: true, 
      forms: formsWithCounts,
      total: formsWithCounts.length
    });
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch forms',
      message: error.message 
    });
  }
};

// Get a single form by ID
const getFormById = async (req, res, db) => {
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
    
    let form;
    try {
      form = await db.collection('forms').findOne({ 
        _id: new ObjectId(id),
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

    // Get submission count
    const submissionCount = await db.collection('form_submissions')
      .countDocuments({ formId: id });

    res.json({ 
      success: true, 
      form: {
        ...form,
        id: form._id.toString(),
        totalSubmissions: submissionCount
      }
    });
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch form',
      message: error.message 
    });
  }
};

// Create a new form
const createForm = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { name, fields, status, settings } = req.body;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Form name is required' 
      });
    }

    // Generate unique source code and form ID
    const sourceCode = `FORM_${Date.now().toString(36).toUpperCase()}`;
    const formId = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newForm = {
      shop,
      name: name.trim(),
      sourceCode,
      formId,
      fields: fields || [],
      status: status || 'Draft',
      settings: settings || {
        submitButtonText: 'Submit',
        successMessage: 'Thank you for your submission!',
        emailNotifications: false,
        notificationEmail: ''
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('forms').insertOne(newForm);

    res.status(201).json({ 
      success: true, 
      message: 'Form created successfully',
      form: {
        ...newForm,
        id: result.insertedId.toString(),
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create form',
      message: error.message 
    });
  }
};

// Update an existing form
const updateForm = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;
    const { name, fields, status, settings } = req.body;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    // Build update object with only provided fields
    const updateData = {
      updatedAt: new Date()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (fields !== undefined) updateData.fields = fields;
    if (status !== undefined) updateData.status = status;
    if (settings !== undefined) updateData.settings = settings;

    let result;
    try {
      result = await db.collection('forms').findOneAndUpdate(
        { _id: new ObjectId(id), shop },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid form ID format' 
      });
    }

    if (!result) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Form updated successfully',
      form: {
        ...result,
        id: result._id.toString()
      }
    });
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update form',
      message: error.message 
    });
  }
};

// Delete a form
const deleteForm = async (req, res, db) => {
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

    let result;
    try {
      result = await db.collection('forms').deleteOne({ 
        _id: new ObjectId(id), 
        shop 
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid form ID format' 
      });
    }

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form not found' 
      });
    }

    // Also delete all submissions for this form
    await db.collection('form_submissions').deleteMany({ formId: id });

    res.json({ 
      success: true, 
      message: 'Form deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete form',
      message: error.message 
    });
  }
};

// Duplicate a form
const duplicateForm = async (req, res, db) => {
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

    let originalForm;
    try {
      originalForm = await db.collection('forms').findOne({ 
        _id: new ObjectId(id), 
        shop 
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid form ID format' 
      });
    }

    if (!originalForm) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form not found' 
      });
    }

    // Create duplicate with new identifiers
    const sourceCode = `FORM_${Date.now().toString(36).toUpperCase()}`;
    const formId = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const duplicatedForm = {
      shop,
      name: `${originalForm.name} (Copy)`,
      sourceCode,
      formId,
      fields: originalForm.fields || [],
      status: 'Draft',
      settings: originalForm.settings || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('forms').insertOne(duplicatedForm);

    res.status(201).json({ 
      success: true, 
      message: 'Form duplicated successfully',
      form: {
        ...duplicatedForm,
        id: result.insertedId.toString(),
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Error duplicating form:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to duplicate form',
      message: error.message 
    });
  }
};

// Update form status (publish/unpublish)
const updateFormStatus = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;
    const { status } = req.body;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    if (!status || !['Active', 'Draft'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid status (Active or Draft) is required' 
      });
    }

    const { ObjectId } = require('mongodb');

    let result;
    try {
      result = await db.collection('forms').findOneAndUpdate(
        { _id: new ObjectId(id), shop },
        { 
          $set: { 
            status,
            updatedAt: new Date(),
            ...(status === 'Active' ? { publishedAt: new Date() } : {})
          }
        },
        { returnDocument: 'after' }
      );
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid form ID format' 
      });
    }

    if (!result) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form not found' 
      });
    }

    res.json({ 
      success: true, 
      message: `Form ${status === 'Active' ? 'published' : 'unpublished'} successfully`,
      form: {
        ...result,
        id: result._id.toString()
      }
    });
  } catch (error) {
    console.error('Error updating form status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update form status',
      message: error.message 
    });
  }
};

module.exports = {
  getAllForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  duplicateForm,
  updateFormStatus
};
